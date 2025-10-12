import {
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
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
}
