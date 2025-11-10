# Docker Deployment Guide

This guide explains how to deploy the web chat application using Docker and Docker Compose.

## Prerequisites

- Docker Engine 20.10+ installed
- Docker Compose 2.0+ installed
- Your Firebase project credentials

## Quick Start

### 1. Set Up Environment Variables

Create a `.env` file in the project root (do not commit this file):

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key_here
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your_project.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_MAX_PARTICIPANTS_PER_ACTION=999

# Firebase Admin SDK (for server-side operations)
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your_project.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour private key here\n-----END PRIVATE KEY-----"
```

**Note**: You can copy your existing `.env.local` file to `.env` for Docker deployment.

### 2. Build and Run

Build and start the container:

```bash
docker-compose up -d --build
```

The application will be available at `http://localhost:3000`

### 3. View Logs

Check application logs:

```bash
docker-compose logs -f web-chat
```

### 4. Stop the Application

Stop the container:

```bash
docker-compose down
```

## Docker Architecture

### Multi-Stage Build

The Dockerfile uses a 3-stage build process for optimal image size and security:

1. **deps**: Installs Node.js dependencies
2. **builder**: Builds the Next.js application with environment variables
3. **runner**: Creates minimal production image with only necessary files

### Key Features

- **Standalone Output**: Next.js standalone mode for minimal image size
- **Non-root User**: Runs as unprivileged user (nextjs:nodejs)
- **Health Check**: Built-in health check endpoint
- **Resource Limits**: CPU and memory limits for stability
- **Auto-restart**: Container restarts automatically on failure

## Environment Variables

### Build-Time Variables (NEXT_PUBLIC_*)

These variables are **baked into the build** and exposed to the browser:

- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`
- `NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID`
- `NEXT_PUBLIC_FIREBASE_DATABASE_URL`
- `NEXT_PUBLIC_MAX_PARTICIPANTS_PER_ACTION`

**Important**: Changes to these variables require rebuilding the Docker image.

### Runtime Variables

These variables are used at runtime (server-side only):

- `FIREBASE_CLIENT_EMAIL` - Admin SDK email
- `FIREBASE_PRIVATE_KEY` - Admin SDK private key
- `NODE_ENV` - Set to `production`

## Common Commands

### Rebuild After Code Changes

```bash
docker-compose up -d --build
```

### Rebuild After Environment Variable Changes

If you change any `NEXT_PUBLIC_*` variables:

```bash
docker-compose build --no-cache
docker-compose up -d
```

### View Container Status

```bash
docker-compose ps
```

### Check Resource Usage

```bash
docker stats
```

### Execute Commands Inside Container

```bash
docker-compose exec web-chat sh
```

### Remove All Data and Rebuild

```bash
docker-compose down -v
docker-compose up -d --build
```

## Production Deployment

### Customize Resource Limits

Edit `docker-compose.yml` to adjust CPU and memory limits:

```yaml
deploy:
  resources:
    limits:
      cpus: '4'
      memory: 4G
    reservations:
      cpus: '1'
      memory: 1G
```

### Change Port

Edit `docker-compose.yml` to change the exposed port:

```yaml
ports:
  - "8080:3000"  # Access at http://localhost:8080
```

### Add Reverse Proxy (Nginx)

For production, use Nginx as reverse proxy:

```yaml
version: '3.8'

services:
  web-chat:
    # ... existing config ...
    expose:
      - "3000"
    networks:
      - web

  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./ssl:/etc/nginx/ssl:ro
    depends_on:
      - web-chat
    networks:
      - web

networks:
  web:
    driver: bridge
```

### Enable HTTPS

1. Obtain SSL certificates (Let's Encrypt recommended)
2. Mount certificates in nginx service
3. Configure nginx.conf for HTTPS

## Troubleshooting

### Container Fails to Start

Check logs:
```bash
docker-compose logs web-chat
```

### Port Already in Use

Change the port in docker-compose.yml or stop the conflicting service:
```bash
sudo lsof -i :3000
```

### Out of Memory

Increase memory limit in docker-compose.yml:
```yaml
limits:
  memory: 4G
```

### Build Fails

Clear Docker cache and rebuild:
```bash
docker system prune -a
docker-compose build --no-cache
```

### Environment Variables Not Working

1. Ensure `.env` file exists in the same directory as `docker-compose.yml`
2. Rebuild if you changed `NEXT_PUBLIC_*` variables:
   ```bash
   docker-compose build --no-cache
   ```

## Health Check

The application includes a health check that runs every 30 seconds:

```bash
# Check health status
docker inspect --format='{{.State.Health.Status}}' web-chat-web-chat-1

# View health check logs
docker inspect --format='{{json .State.Health}}' web-chat-web-chat-1
```

Note: You need to create a simple health check endpoint at `/api/health` in your Next.js app, or remove the health check from docker-compose.yml.

## Security Best Practices

1. **Never commit `.env` file** - Add to `.gitignore`
2. **Use secrets management** - For production, use Docker secrets or external vaults
3. **Regular updates** - Keep base images and dependencies updated
4. **Scan for vulnerabilities** - Use `docker scan` to check for security issues
5. **Run as non-root** - Already configured in Dockerfile
6. **Limit resources** - Prevent DoS by setting CPU/memory limits

## CI/CD Integration

### GitHub Actions Example

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Build Docker image
        run: docker-compose build

      - name: Push to registry
        run: |
          docker tag web-chat:latest registry.example.com/web-chat:latest
          docker push registry.example.com/web-chat:latest
```

## Monitoring

Consider adding monitoring tools:

- **Container metrics**: Prometheus + Grafana
- **Logs**: ELK Stack or Loki
- **APM**: New Relic, DataDog, or Sentry
- **Uptime**: UptimeRobot or Pingdom

## Backup Strategy

Important data to backup:

1. Firebase configuration (`.env` file)
2. Docker volumes (if any)
3. Source code in Git repository

## Support

For issues or questions:
- Check logs: `docker-compose logs -f`
- Verify environment variables: `docker-compose config`
- Test locally first before deploying to production
