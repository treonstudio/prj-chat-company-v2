import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

export interface UsageControls {
  maxFileSizeUploadedInMB: number;
}

export class UsageControlsRepository {
  private readonly APP_CONFIGS_COLLECTION = 'appConfigs';
  private readonly USAGE_CONTROLS_DOCUMENT = 'usageControls';

  /**
   * Listen to usage controls changes in real-time
   */
  getUsageControls(
    onUpdate: (controls: UsageControls) => void,
    onError: (error: string) => void
  ): () => void {
    const usageControlsRef = doc(
      db(),
      this.APP_CONFIGS_COLLECTION,
      this.USAGE_CONTROLS_DOCUMENT
    );

    const unsubscribe = onSnapshot(
      usageControlsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as UsageControls;
          onUpdate(data);
        } else {
          // Default value if document doesn't exist
          onUpdate({
            maxFileSizeUploadedInMB: 5, // Default 5MB
          });
        }
      },
      (error) => {
        onError(error.message || 'Failed to fetch usage controls');
      }
    );

    return unsubscribe;
  }
}
