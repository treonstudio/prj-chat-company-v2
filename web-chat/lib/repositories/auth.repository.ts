import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updatePassword as firebaseUpdatePassword,
  EmailAuthProvider,
  reauthenticateWithCredential,
  User as FirebaseUser
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { Resource } from '@/types/resource';

export class AuthRepository {
  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<Resource<FirebaseUser>> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return Resource.success(userCredential.user);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to sign in');
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<Resource<void>> {
    try {
      await firebaseSignOut(auth);
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to sign out');
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): FirebaseUser | null {
    return auth.currentUser;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(auth, callback);
  }

  /**
   * Update user password
   * Requires the user to have recently signed in
   */
  async updatePassword(newPassword: string): Promise<Resource<void>> {
    try {
      const user = auth.currentUser;
      if (!user) {
        return Resource.error('No user is currently signed in');
      }

      await firebaseUpdatePassword(user, newPassword);
      return Resource.success(undefined);
    } catch (error: any) {
      // If the error is about requiring recent login, inform the user
      if (error.code === 'auth/requires-recent-login') {
        return Resource.error('Please log out and log in again before changing your password');
      }
      return Resource.error(error.message || 'Failed to update password');
    }
  }

  /**
   * Reauthenticate user with current password
   * This is required before sensitive operations like password change
   */
  async reauthenticate(currentPassword: string): Promise<Resource<void>> {
    try {
      const user = auth.currentUser;
      if (!user || !user.email) {
        return Resource.error('No user is currently signed in');
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      return Resource.success(undefined);
    } catch (error: any) {
      if (error.code === 'auth/wrong-password') {
        return Resource.error('Current password is incorrect');
      }
      return Resource.error(error.message || 'Failed to verify current password');
    }
  }
}
