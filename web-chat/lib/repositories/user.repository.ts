import { doc, getDoc, updateDoc, collection, query, where, getDocs, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { User } from '@/types/models';
import { Resource } from '@/types/resource';

export class UserRepository {
  private readonly COLLECTION = 'users';

  /**
   * Get user by ID
   */
  async getUserById(userId: string): Promise<Resource<User>> {
    try {
      const userDoc = await getDoc(doc(db, this.COLLECTION, userId));

      if (!userDoc.exists()) {
        return Resource.error('User not found');
      }

      const userData = userDoc.data() as User;
      return Resource.success({ ...userData, userId: userDoc.id });
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to fetch user');
    }
  }

  /**
   * Update FCM token (not used in web app, but keeping for consistency)
   */
  async updateFcmToken(userId: string, token: string): Promise<Resource<void>> {
    try {
      await updateDoc(doc(db, this.COLLECTION, userId), {
        fcmToken: token
      });
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to update FCM token');
    }
  }

  /**
   * Search users by display name
   */
  async searchUsers(searchQuery: string, currentUserId: string, maxResults: number = 20): Promise<Resource<User[]>> {
    try {
      if (!searchQuery || searchQuery.trim().length === 0) {
        return Resource.success([]);
      }

      const searchTerm = searchQuery.toLowerCase().trim();
      const usersRef = collection(db, this.COLLECTION);

      // Get all users and filter client-side (Firestore doesn't support case-insensitive search directly)
      const q = query(usersRef, limit(100)); // Get more users to filter
      const snapshot = await getDocs(q);

      const users: User[] = [];
      snapshot.forEach((doc) => {
        const userData = doc.data() as User;
        const user = { ...userData, userId: doc.id };

        // Filter out current user and search by displayName or email
        if (user.userId !== currentUserId) {
          const displayName = (user.displayName || '').toLowerCase();
          const email = (user.email || '').toLowerCase();

          if (displayName.includes(searchTerm) || email.includes(searchTerm)) {
            users.push(user);
          }
        }
      });

      // Limit results
      return Resource.success(users.slice(0, maxResults));
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to search users');
    }
  }

  /**
   * Get multiple users by IDs
   */
  async getUsersByIds(userIds: string[]): Promise<Resource<User[]>> {
    try {
      const users: User[] = [];

      for (const userId of userIds) {
        const userDoc = await getDoc(doc(db, this.COLLECTION, userId));
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          users.push({ ...userData, userId: userDoc.id });
        }
      }

      return Resource.success(users);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to fetch users');
    }
  }

  /**
   * Update user avatar URL
   */
  async updateAvatar(userId: string, avatarUrl: string): Promise<Resource<void>> {
    try {
      await updateDoc(doc(db, this.COLLECTION, userId), {
        avatarUrl: avatarUrl
      });
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to update avatar');
    }
  }

  /**
   * Update user display name
   */
  async updateDisplayName(userId: string, displayName: string): Promise<Resource<void>> {
    try {
      await updateDoc(doc(db, this.COLLECTION, userId), {
        displayName: displayName
      });
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to update display name');
    }
  }

  /**
   * Listen to user document changes in real-time
   * Used to detect if user is deleted or updated
   */
  listenToUser(
    userId: string,
    onUpdate: (user: User) => void,
    onError: (error: string) => void
  ): () => void {
    const userRef = doc(db, this.COLLECTION, userId);

    const unsubscribe = onSnapshot(
      userRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const userData = snapshot.data() as User;
          onUpdate({ ...userData, userId: snapshot.id });
        } else {
          // User document has been deleted
          onError('User document has been deleted');
        }
      },
      (error) => {
        onError(error.message || 'Failed to listen to user changes');
      }
    );

    return unsubscribe;
  }
}
