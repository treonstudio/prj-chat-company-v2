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
   * Map Firebase auth error codes to user-friendly Indonesian messages
   */
  private getAuthErrorMessage(errorCode: string): string {
    const errorMessages: Record<string, string> = {
      'auth/invalid-credential': 'Username atau password yang Anda masukkan salah',
      'auth/user-not-found': 'Username tidak terdaftar',
      'auth/wrong-password': 'Password yang Anda masukkan salah',
      'auth/invalid-email': 'Format email tidak valid',
      'auth/user-disabled': 'Akun Anda telah dinonaktifkan',
      'auth/too-many-requests': 'Terlalu banyak percobaan login. Silakan coba lagi nanti',
      'auth/network-request-failed': 'Koneksi internet bermasalah. Periksa koneksi Anda',
      'auth/weak-password': 'Password terlalu lemah. Gunakan minimal 6 karakter',
      'auth/email-already-in-use': 'Email sudah terdaftar',
      'auth/operation-not-allowed': 'Operasi tidak diizinkan',
      'auth/requires-recent-login': 'Silakan login ulang untuk melanjutkan',
    };

    return errorMessages[errorCode] || 'Terjadi kesalahan saat login. Silakan coba lagi';
  }

  /**
   * Sign in with email and password
   */
  async signIn(email: string, password: string): Promise<Resource<FirebaseUser>> {
    try {
      const userCredential = await signInWithEmailAndPassword(auth(), email, password);
      return Resource.success(userCredential.user);
    } catch (error: any) {
      const errorMessage = error.code ? this.getAuthErrorMessage(error.code) : 'Gagal login. Silakan coba lagi';
      return Resource.error(errorMessage);
    }
  }

  /**
   * Sign out
   */
  async signOut(): Promise<Resource<void>> {
    try {
      await firebaseSignOut(auth());
      return Resource.success(undefined);
    } catch (error: any) {
      return Resource.error(error.message || 'Failed to sign out');
    }
  }

  /**
   * Get current user
   */
  getCurrentUser(): FirebaseUser | null {
    return auth().currentUser;
  }

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (user: FirebaseUser | null) => void): () => void {
    return onAuthStateChanged(auth(), callback);
  }

  /**
   * Update user password
   * Requires the user to have recently signed in
   */
  async updatePassword(newPassword: string): Promise<Resource<void>> {
    try {
      const user = auth().currentUser;
      if (!user) {
        return Resource.error('Tidak ada user yang sedang login');
      }

      await firebaseUpdatePassword(user, newPassword);
      return Resource.success(undefined);
    } catch (error: any) {
      const errorMessage = error.code ? this.getAuthErrorMessage(error.code) : 'Gagal mengubah password';
      return Resource.error(errorMessage);
    }
  }

  /**
   * Reauthenticate user with current password
   * This is required before sensitive operations like password change
   */
  async reauthenticate(currentPassword: string): Promise<Resource<void>> {
    try {
      const user = auth().currentUser;
      if (!user || !user.email) {
        return Resource.error('Tidak ada user yang sedang login');
      }

      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      return Resource.success(undefined);
    } catch (error: any) {
      const errorMessage = error.code ? this.getAuthErrorMessage(error.code) : 'Gagal memverifikasi password';
      return Resource.error(errorMessage);
    }
  }
}
