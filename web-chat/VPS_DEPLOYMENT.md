# VPS Deployment Guide

This guide explains how to deploy the web chat application to a VPS (Virtual Private Server).

## Prerequisites

- VPS with at least 2GB RAM (recommended 4GB)
- Ubuntu 20.04+ or Debian 11+ (recommended)
- Root or sudo access
- Domain name (optional, but recommended for HTTPS)

## Step 1: Prepare Your VPS

### 1.1 Connect to VPS via SSH

```bash
ssh root@your-vps-ip
# or
ssh your-username@your-vps-ip
```

### 1.2 Update System

```bash
sudo apt update
sudo apt upgrade -y
```

### 1.3 Install Docker

```bash
# Install dependencies
sudo apt install -y ca-certificates curl gnupg lsb-release

# Add Docker's official GPG key
sudo mkdir -p /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg

# Set up the repository
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

# Install Docker Engine
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin

# Verify installation
docker --version
docker compose version
```

### 1.4 Optional: Add User to Docker Group (Non-root)

```bash
sudo usermod -aG docker $USER
# Log out and back in for changes to take effect
```

## Step 2: Transfer Files to VPS

### Option A: Using Git (Recommended)

```bash
# On VPS
cd /opt  # or your preferred directory
sudo git clone https://github.com/your-username/your-repo.git web-chat
cd web-chat

# If private repo, set up SSH key or use HTTPS with credentials
```

### Option B: Using SCP (Secure Copy)

```bash
# On your local machine
cd /Users/fa-15506/go/src/github.com/Treon-Studio/prj-chat-company-v2/web-chat

# Copy entire project to VPS
scp -r . your-username@your-vps-ip:/opt/web-chat

# Or use rsync (faster for updates)
rsync -avz --exclude 'node_modules' --exclude '.next' \
  . your-username@your-vps-ip:/opt/web-chat
```

### Option C: Using SFTP

```bash
# On your local machine
sftp your-username@your-vps-ip

# In SFTP prompt
put -r /Users/fa-15506/go/src/github.com/Treon-Studio/prj-chat-company-v2/web-chat /opt/web-chat
```

## Step 3: Configure Environment Variables

### 3.1 Create .env File on VPS

```bash
# On VPS
cd /opt/web-chat
nano .env
```

### 3.2 Add Your Environment Variables

```bash
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSyAWd46SC0Ovft5EiGHrvNh1RajTMTlakNo
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=bc-chat-a96de.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=bc-chat-a96de
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=bc-chat-a96de.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=346082749497
NEXT_PUBLIC_FIREBASE_APP_ID=1:346082749497:web:d0d327f6452723893bb1e8
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-76PCL6TJ5G
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://bc-chat-a96de-default-rtdb.asia-southeast1.firebasedatabase.app
NEXT_PUBLIC_MAX_PARTICIPANTS_PER_ACTION=999

# Firebase Admin SDK
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-fbsvc@bc-chat-a96de.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour_Private_Key_Here\n-----END PRIVATE KEY-----"
```

Save and exit (Ctrl+X, then Y, then Enter)

## Step 4: Build and Run with Docker

### 4.1 Build and Start the Application

```bash
cd /opt/web-chat
sudo docker compose up -d --build
```

### 4.2 Check Status

```bash
# View running containers
sudo docker compose ps

# View logs
sudo docker compose logs -f web-chat

# Check if container is running
sudo docker ps
```

### 4.3 Test Application

```bash
# Test locally on VPS
curl http://localhost:3000

# If successful, you should see HTML response
```

## Step 5: Configure Firewall

### 5.1 UFW (Ubuntu Firewall)

```bash
# Enable firewall
sudo ufw enable

# Allow SSH (important!)
sudo ufw allow 22/tcp

# Allow HTTP and HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Optionally allow direct access to port 3000 (for testing)
sudo ufw allow 3000/tcp

# Check status
sudo ufw status
```

## Step 6: Set Up Nginx Reverse Proxy (Recommended)

### 6.1 Install Nginx

```bash
sudo apt install -y nginx
```

### 6.2 Create Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/web-chat
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Increase client body size for file uploads
    client_max_body_size 50M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }
}
```

### 6.3 Enable Site

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/web-chat /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
sudo systemctl enable nginx
```

## Step 7: Set Up HTTPS with Let's Encrypt (Recommended)

### 7.1 Install Certbot

```bash
sudo apt install -y certbot python3-certbot-nginx
```

### 7.2 Obtain SSL Certificate

```bash
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Follow the prompts. Certbot will automatically configure Nginx for HTTPS.

### 7.3 Test Auto-Renewal

```bash
sudo certbot renew --dry-run
```

## Step 8: Configure Auto-Start on Boot

Docker containers with `restart: unless-stopped` will automatically start on boot.

Verify:
```bash
sudo systemctl enable docker
```

## Step 9: Monitor and Maintain

### 9.1 View Logs

```bash
# Docker logs
sudo docker compose logs -f web-chat

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### 9.2 Restart Application

```bash
cd /opt/web-chat
sudo docker compose restart
```

### 9.3 Update Application

```bash
cd /opt/web-chat

# Pull latest code (if using Git)
git pull

# Rebuild and restart
sudo docker compose up -d --build
```

### 9.4 Stop Application

```bash
sudo docker compose down
```

## Production Optimization

### 1. Increase Docker Resources

Edit docker-compose.yml:
```yaml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 2G
```

### 2. Set Up Monitoring

Install monitoring tools:
```bash
# Install htop for system monitoring
sudo apt install -y htop

# Monitor Docker stats
sudo docker stats
```

### 3. Regular Backups

```bash
# Backup script
#!/bin/bash
BACKUP_DIR="/backup/web-chat"
DATE=$(date +%Y%m%d_%H%M%S)

# Backup environment file
cp /opt/web-chat/.env $BACKUP_DIR/.env.$DATE

# Backup using Git
cd /opt/web-chat
git add .
git commit -m "Backup $DATE"
git push
```

### 4. Security Hardening

```bash
# Disable root SSH login
sudo nano /etc/ssh/sshd_config
# Set: PermitRootLogin no

# Restart SSH
sudo systemctl restart sshd

# Install fail2ban
sudo apt install -y fail2ban
sudo systemctl enable fail2ban
sudo systemctl start fail2ban
```

## Troubleshooting

### Container Won't Start

```bash
# Check logs
sudo docker compose logs web-chat

# Check if port is in use
sudo lsof -i :3000

# Rebuild from scratch
sudo docker compose down -v
sudo docker compose up -d --build
```

### Out of Memory

```bash
# Check memory usage
free -h

# Clean up Docker
sudo docker system prune -a

# Increase swap space
sudo fallocate -l 4G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Nginx 502 Bad Gateway

```bash
# Check if Docker container is running
sudo docker ps

# Check Docker logs
sudo docker compose logs web-chat

# Check Nginx error log
sudo tail -f /var/log/nginx/error.log
```

### SSL Certificate Issues

```bash
# Renew certificate manually
sudo certbot renew

# Check certificate status
sudo certbot certificates
```

## Quick Reference Commands

```bash
# Start application
sudo docker compose up -d

# Stop application
sudo docker compose down

# Restart application
sudo docker compose restart

# View logs
sudo docker compose logs -f

# Rebuild application
sudo docker compose up -d --build

# Check status
sudo docker compose ps

# SSH to VPS
ssh your-username@your-vps-ip

# Update code (Git)
git pull && sudo docker compose up -d --build
```

## Cost Optimization

### Recommended VPS Providers

- **DigitalOcean**: $12/month (2GB RAM)
- **Linode**: $12/month (2GB RAM)
- **Vultr**: $12/month (2GB RAM)
- **Hetzner**: €4.5/month (4GB RAM) - Best value
- **AWS Lightsail**: $10/month (2GB RAM)

### Minimum Specs

- **CPU**: 1 core (2 cores recommended)
- **RAM**: 2GB (4GB recommended)
- **Storage**: 20GB SSD
- **Bandwidth**: 1TB/month

## DNS Configuration

Point your domain to VPS:

1. Go to your domain registrar
2. Add A record:
   - Type: A
   - Name: @ (or your subdomain)
   - Value: your-vps-ip
   - TTL: 3600

3. Add CNAME for www (optional):
   - Type: CNAME
   - Name: www
   - Value: your-domain.com
   - TTL: 3600

Wait 5-60 minutes for DNS propagation.

## Access Your Application

- HTTP: `http://your-domain.com`
- HTTPS: `https://your-domain.com` (after SSL setup)
- Direct IP: `http://your-vps-ip:3000` (if firewall allows)

## Next Steps

1. Set up monitoring (Uptime Robot, Pingdom)
2. Configure automated backups
3. Set up CI/CD pipeline (GitHub Actions)
4. Enable CDN (Cloudflare)
5. Configure log rotation
6. Set up error tracking (Sentry)
