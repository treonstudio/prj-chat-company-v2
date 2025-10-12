# Firebase Cloud Functions Deployment Guide

## Prerequisites ✅

- [x] Node.js installed (v20.19.2)
- [x] Firebase CLI installed (v13.7.2)
- [x] Cloud Functions code created
- [x] Dependencies installed

## Step-by-Step Deployment

### Step 1: Login to Firebase

Open your terminal and run:

```bash
firebase login
```

This will:
- Open your web browser
- Ask you to sign in with your Google account
- Give Firebase CLI access to your Firebase projects

### Step 2: Set Your Firebase Project ID

**Option A: Edit .firebaserc manually**

Open `.firebaserc` and replace `your-project-id` with your actual Firebase project ID:

```json
{
  "projects": {
    "default": "your-actual-project-id"
  }
}
```

**Option B: Use Firebase CLI**

Run this command and select your project from the list:

```bash
firebase use --add
```

### Step 3: Enable Blaze Plan (Required)

Cloud Functions require the **Blaze (pay-as-you-go)** plan.

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Click "Upgrade" at the bottom left
4. Select "Blaze" plan

**Don't worry!** The free tier is very generous:
- 2 million function invocations/month
- For a personal chat app, you'll likely never exceed the free tier

### Step 4: Deploy Functions

From the project root directory:

```bash
firebase deploy --only functions
```

This will:
- Upload your Cloud Functions to Firebase
- Set up triggers for Firestore document creation
- Show deployment progress and success/failure

**Expected output:**
```
=== Deploying to 'your-project-id'...

i  deploying functions
i  functions: ensuring required API cloudfunctions.googleapis.com is enabled...
i  functions: ensuring required API cloudbuild.googleapis.com is enabled...
✔  functions: required API cloudfunctions.googleapis.com is enabled
✔  functions: required API cloudbuild.googleapis.com is enabled
i  functions: preparing codebase default for deployment
i  functions: uploading codebase...
✔  functions: Finished uploading codebase
i  functions: creating Node.js 20 function sendDirectMessageNotification...
i  functions: creating Node.js 20 function sendGroupMessageNotification...
✔  functions[sendDirectMessageNotification]: Successful create operation.
✔  functions[sendGroupMessageNotification]: Successful create operation.

✔  Deploy complete!
```

### Step 5: Verify Deployment

1. **Check Firebase Console:**
   - Go to [Firebase Console](https://console.firebase.google.com)
   - Click on your project
   - Go to "Functions" in the left menu
   - You should see 2 functions listed:
     - `sendDirectMessageNotification`
     - `sendGroupMessageNotification`

2. **Check Function Logs:**
   ```bash
   firebase functions:log
   ```

## Testing the Notifications

### Test Scenario 1: Direct Message

1. **Setup:**
   - Install app on Device A (User 1)
   - Install app on Device B (User 2)
   - Both users log in

2. **Test:**
   - User 1 opens app and sends message to User 2
   - **Close or background the app on Device B**
   - User 2 should receive notification

3. **Verify:**
   - Check notification appears on Device B
   - Tap notification to open chat
   - Check Firebase Console > Functions > Logs

### Test Scenario 2: Multiple Messages

1. User 1 sends 3 messages quickly to User 2 (who is offline)
2. User 2 should receive 3 separate notifications
3. Check logs to see all 3 function invocations

### Troubleshooting

#### "Error: HTTP Error: 403, Firebase Cloud Functions API has not been used"

**Solution:** Enable the Cloud Functions API
```bash
firebase deploy --only functions
```
This will prompt you to enable required APIs.

#### "Error: billing account not configured"

**Solution:** Upgrade to Blaze plan (see Step 3 above)

#### Notification not received

**Checklist:**
- [ ] App is in background/closed (notifications don't show when app is open)
- [ ] User has FCM token saved in Firestore (`users/{userId}/fcmToken`)
- [ ] Notification permission granted on device
- [ ] Function deployed successfully (check Firebase Console)
- [ ] Check function logs: `firebase functions:log`

#### Function not triggering

**Checklist:**
- [ ] Check Firestore path: `directChats/{chatId}/messages/{messageId}`
- [ ] Message document has `senderId`, `senderName`, `text` fields
- [ ] Chat document has `participants` array
- [ ] Check function logs for errors

## Updating Functions

After making changes to `functions/index.js`:

```bash
# Deploy all functions
firebase deploy --only functions

# Or deploy specific function
firebase deploy --only functions:sendDirectMessageNotification
```

## Monitoring and Logs

### View logs in real-time
```bash
firebase functions:log --only sendDirectMessageNotification
```

### View logs in Firebase Console
1. Firebase Console > Functions
2. Click on function name
3. Go to "Logs" tab

## Cost Estimation

For a typical small chat app:
- **Average:** $0-5/month
- **Free tier covers:** ~2 million messages/month

Example calculation:
- 100 active users
- Each sends 20 messages/day
- Total: 2,000 messages/day = 60,000 messages/month
- **Well within free tier!**

## Next Steps

After successful deployment:
1. Test thoroughly with different scenarios
2. Monitor logs for any errors
3. Add more Cloud Functions as needed (e.g., delete old messages, moderate content)
4. Set up Cloud Function monitoring alerts

## Useful Commands

```bash
# View all Firebase projects
firebase projects:list

# Switch project
firebase use <project-id>

# Deploy functions only
firebase deploy --only functions

# Deploy specific function
firebase deploy --only functions:functionName

# View logs
firebase functions:log

# Delete a function
firebase functions:delete functionName
```

## Support

If you encounter issues:
1. Check Firebase Console > Functions > Logs
2. Run `firebase functions:log` in terminal
3. Search [Firebase documentation](https://firebase.google.com/docs/functions)
4. Check [StackOverflow firebase-cloud-functions tag](https://stackoverflow.com/questions/tagged/firebase-cloud-functions)
