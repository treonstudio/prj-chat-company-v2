# Chatku Cloud Functions - Push Notifications

This folder contains Firebase Cloud Functions that automatically send push notifications when new messages are sent.

## Functions Included

1. **sendDirectMessageNotification** - Sends notifications for direct chat messages
2. **sendGroupMessageNotification** - Sends notifications for group chat messages

## How It Works

When a message is added to Firestore:
1. Cloud Function is triggered automatically
2. Gets the chat participants from the parent chat document
3. Finds the receiver(s) by filtering out the sender
4. Gets receiver's FCM token from users collection
5. Sends FCM notification using Firebase Admin SDK

## Setup Instructions

### 1. Login to Firebase CLI
```bash
firebase login
```

### 2. Set Your Firebase Project
Edit `.firebaserc` in the root directory and replace `your-project-id` with your actual Firebase project ID.

Or run:
```bash
firebase use --add
```
Then select your project from the list.

### 3. Deploy Functions
```bash
firebase deploy --only functions
```

Or to deploy a specific function:
```bash
firebase deploy --only functions:sendDirectMessageNotification
firebase deploy --only functions:sendGroupMessageNotification
```

## Testing

### View Logs
```bash
firebase functions:log
```

### Test Locally (Optional)
You can test functions locally using the Firebase Emulator:
```bash
npm run serve
```

## Notification Payload

The notification includes:
- **title**: Sender name
- **body**: Message text
- **data**:
  - chatId
  - senderId
  - senderName
  - messageText

## Troubleshooting

### Function not triggering
- Check Firebase Console > Functions to see if deployed
- Check logs: `firebase functions:log`
- Verify Firestore path matches: `directChats/{chatId}/messages/{messageId}`

### Notification not received
- Check if receiver has FCM token in Firestore
- Verify app has notification permission
- Check if app is in background (notifications only show when app is closed/background)
- Check Android notification channel is created

### Deployment fails
- Make sure you're logged in: `firebase login`
- Make sure project is set: `firebase use --add`
- Check if billing is enabled (Cloud Functions require Blaze plan)

## Billing Note

Firebase Cloud Functions require the **Blaze (pay-as-you-go) plan**.

Free tier includes:
- 2 million invocations/month
- 400,000 GB-seconds
- 200,000 CPU-seconds
- 5GB network egress

For a small chat app, you'll likely stay within the free tier.

## File Structure

```
functions/
├── index.js          # Main Cloud Functions code
├── package.json      # Dependencies and scripts
├── .eslintrc.js      # ESLint configuration
├── .gitignore        # Git ignore rules
└── node_modules/     # Installed packages (auto-generated)
```

## Next Steps

After deploying:
1. Send a test message in your app
2. Check Firebase Console > Functions to see invocations
3. Check logs to verify notification was sent
4. Check receiving device to see notification appear
