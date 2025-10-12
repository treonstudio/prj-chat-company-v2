import { doc, getDoc, updateDoc } from 'firebase/firestore';
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
}
