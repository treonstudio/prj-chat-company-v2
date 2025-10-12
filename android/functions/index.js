const functions = require("firebase-functions");
const admin = require("firebase-admin");
const { RtcTokenBuilder, RtcRole } = require("agora-token");

admin.initializeApp();

/**
 * Generate Agora token for voice calls
 */
exports.generateAgoraToken = functions.https.onCall(async (data, context) => {
    // Verify user is authenticated
    if (!context.auth) {
        throw new functions.https.HttpsError(
            'unauthenticated',
            'User must be authenticated to generate token'
        );
    }

    // Get Agora credentials from environment variables
    const appId = functions.config().agora.app_id || process.env.AGORA_APP_ID;
    const appCertificate = functions.config().agora.app_certificate || process.env.AGORA_APP_CERTIFICATE;

    // Validate credentials
    if (!appId || !appCertificate) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Agora credentials not configured'
        );
    }

    // Extract and validate parameters
    const { channelName, account } = data;

    if (!channelName || !account) {
        throw new functions.https.HttpsError(
            'invalid-argument',
            'channelName and account are required'
        );
    }

    const userRole = RtcRole.PUBLISHER;
    const tokenExpirationInSecond = 3600;
    const privilegeExpirationInSecond = 3600;

    try {
        const currentTime = Math.floor(Date.now() / 1000);
        const privilegeExpiredTs = currentTime + privilegeExpirationInSecond;

        const token = RtcTokenBuilder.buildTokenWithUserAccount(
            appId,
            appCertificate,
            channelName,
            account,
            userRole,
            tokenExpirationInSecond,
            privilegeExpirationInSecond
        );

        return {
            token: token,
            appId: appId,
            channelName: channelName,
            account: account,
            expiresAt: privilegeExpiredTs
        };

    } catch (error) {
        console.error('Error generating Agora token:', error);
        throw new functions.https.HttpsError(
            'internal',
            'Failed to generate token'
        );
    }
});

/**
 * Send notification when a new message is sent in direct chat
 */
exports.sendDirectMessageNotification = functions.firestore
    .document("directChats/{chatId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
      const message = snap.data();
      const chatId = context.params.chatId;
      const senderId = message.senderId;

      try {
        console.log("New message in chat:", chatId, "from:", senderId);

        // Get the chat document to access participants
        const chatDoc = await admin.firestore()
            .collection("directChats")
            .doc(chatId)
            .get();

        if (!chatDoc.exists) {
          console.log("Chat document not found");
          return null;
        }

        const participants = chatDoc.data().participants;

        // Find receiver (the participant who is NOT the sender)
        const receiverId = participants.find((id) => id !== senderId);

        if (!receiverId) {
          console.log("Receiver not found");
          return null;
        }

        console.log("Receiver ID:", receiverId);

        // Get receiver's FCM token
        const receiverDoc = await admin.firestore()
            .collection("users")
            .doc(receiverId)
            .get();

        if (!receiverDoc.exists) {
          console.log("Receiver user document not found");
          return null;
        }

        const fcmToken = receiverDoc.data().fcmToken;

        if (!fcmToken) {
          console.log("Receiver has no FCM token");
          return null;
        }

        console.log("Sending notification to token:", fcmToken.substring(0, 20) + "...");

        // Send notification
        const notificationMessage = {
          token: fcmToken,
          notification: {
            title: message.senderName || "New Message",
            body: message.text || "You have a new message",
          },
          data: {
            chatId: chatId,
            senderId: senderId,
            senderName: message.senderName || "",
            messageText: message.text || "",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "chatku_messages",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
        };

        const response = await admin.messaging().send(notificationMessage);
        console.log("Notification sent successfully:", response);

        return null;
      } catch (error) {
        console.error("Error sending notification:", error);
        return null;
      }
    });

/**
 * Send notification when a new call is initiated
 */
exports.sendIncomingCallNotification = functions.firestore
    .document("calls/{callId}")
    .onCreate(async (snap, context) => {
      const call = snap.data();
      const callId = context.params.callId;

      try {
        // Only send notification if call status is ringing
        if (call.status !== "ringing") {
          console.log("Call status is not ringing, skipping notification");
          return null;
        }

        console.log("New call initiated:", callId);

        const callerId = call.callerId;
        const receiverId = call.receiverId;
        const callerName = call.callerName || "Unknown";

        if (!receiverId) {
          console.log("Receiver ID not found");
          return null;
        }

        console.log("Receiver ID:", receiverId);

        // Get receiver's FCM token
        const receiverDoc = await admin.firestore()
            .collection("users")
            .doc(receiverId)
            .get();

        if (!receiverDoc.exists) {
          console.log("Receiver user document not found");
          return null;
        }

        const fcmToken = receiverDoc.data().fcmToken;

        if (!fcmToken) {
          console.log("Receiver has no FCM token");
          return null;
        }

        console.log("Sending call notification to token:", fcmToken.substring(0, 20) + "...");

        // Send high-priority notification with data payload
        const notificationMessage = {
          token: fcmToken,
          data: {
            type: "incoming_call",
            callId: callId,
            callerId: callerId,
            callerName: callerName,
          },
          android: {
            priority: "high",
            ttl: 30000, // 30 seconds TTL for calls
          },
          apns: {
            headers: {
              "apns-priority": "10",
            },
            payload: {
              aps: {
                contentAvailable: true,
                sound: "default",
              },
            },
          },
        };

        const response = await admin.messaging().send(notificationMessage);
        console.log("Call notification sent successfully:", response);

        return null;
      } catch (error) {
        console.error("Error sending call notification:", error);
        return null;
      }
    });

/**
 * Automatically mark call as MISSED after 30 seconds timeout
 */
exports.handleCallTimeout = functions.firestore
    .document("calls/{callId}")
    .onCreate(async (snap, context) => {
      const call = snap.data();
      const callId = context.params.callId;

      try {
        // Only handle calls that are in ringing state
        if (call.status !== "ringing") {
          console.log("Call is not ringing, skipping timeout handler");
          return null;
        }

        console.log("Setting up timeout for call:", callId);

        // Wait for 30 seconds
        await new Promise(resolve => setTimeout(resolve, 30000));

        // Check if call is still in ringing state
        const callDoc = await admin.firestore()
            .collection("calls")
            .doc(callId)
            .get();

        if (!callDoc.exists) {
          console.log("Call document no longer exists");
          return null;
        }

        const currentStatus = callDoc.data().status;

        // If still ringing after 30 seconds, mark as MISSED
        if (currentStatus === "ringing") {
          console.log("Call timed out, marking as MISSED:", callId);

          await admin.firestore()
              .collection("calls")
              .doc(callId)
              .update({
                status: "missed",
                endedAt: admin.firestore.FieldValue.serverTimestamp()
              });

          console.log("Call marked as MISSED successfully");
        } else {
          console.log("Call status changed to", currentStatus, "no timeout needed");
        }

        return null;
      } catch (error) {
        console.error("Error handling call timeout:", error);
        return null;
      }
    });

/**
 * Send notification when a new message is sent in group chat
 */
exports.sendGroupMessageNotification = functions.firestore
    .document("groupChats/{chatId}/messages/{messageId}")
    .onCreate(async (snap, context) => {
      const message = snap.data();
      const chatId = context.params.chatId;
      const senderId = message.senderId;

      try {
        console.log("New group message in chat:", chatId, "from:", senderId);

        // Get the chat document to access participants
        const chatDoc = await admin.firestore()
            .collection("groupChats")
            .doc(chatId)
            .get();

        if (!chatDoc.exists) {
          console.log("Group chat document not found");
          return null;
        }

        const participants = chatDoc.data().participants;
        const groupName = chatDoc.data().name || "Group Chat";

        // Get all receivers (everyone except sender)
        const receiverIds = participants.filter((id) => id !== senderId);

        if (receiverIds.length === 0) {
          console.log("No receivers found");
          return null;
        }

        console.log("Receiver IDs:", receiverIds);

        // Get all receiver tokens
        const receiverDocs = await Promise.all(
            receiverIds.map((id) =>
              admin.firestore().collection("users").doc(id).get(),
            ),
        );

        // Extract FCM tokens
        const tokens = receiverDocs
            .filter((doc) => doc.exists && doc.data().fcmToken)
            .map((doc) => doc.data().fcmToken);

        if (tokens.length === 0) {
          console.log("No receivers with FCM tokens");
          return null;
        }

        console.log("Sending notifications to", tokens.length, "devices");

        // Send notification to all receivers
        const notificationMessage = {
          notification: {
            title: `${message.senderName || "Someone"} in ${groupName}`,
            body: message.text || "You have a new message",
          },
          data: {
            chatId: chatId,
            senderId: senderId,
            senderName: message.senderName || "",
            messageText: message.text || "",
          },
          android: {
            priority: "high",
            notification: {
              sound: "default",
              channelId: "chatku_messages",
            },
          },
          apns: {
            payload: {
              aps: {
                sound: "default",
              },
            },
          },
          tokens: tokens,
        };

        const response = await admin.messaging().sendEachForMulticast(notificationMessage);
        console.log("Notifications sent. Success:", response.successCount, "Failure:", response.failureCount);

        return null;
      } catch (error) {
        console.error("Error sending group notification:", error);
        return null;
      }
    });