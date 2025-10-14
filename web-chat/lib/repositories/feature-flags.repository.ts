import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { FeatureFlags } from '@/types/models';

export class FeatureFlagsRepository {
  private readonly APP_CONFIGS_COLLECTION = 'appConfigs';
  private readonly FEATURES_DOCUMENT = 'features';

  /**
   * Get feature flags with real-time updates
   */
  getFeatureFlags(
    onUpdate: (flags: FeatureFlags) => void,
    onError: (error: string) => void
  ): () => void {
    const featureFlagsRef = doc(
      db,
      this.APP_CONFIGS_COLLECTION,
      this.FEATURES_DOCUMENT
    );

    const unsubscribe = onSnapshot(
      featureFlagsRef,
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as FeatureFlags;
          onUpdate(data);
        } else {
          // Default values if document doesn't exist
          onUpdate({
            allowCall: true,
            allowChat: true,
            allowCreateGroup: true,
            allowSendText: true,
            allowSendMedia: true,
          });
        }
      },
      (error) => {
        onError(error.message || 'Failed to fetch feature flags');
      }
    );

    return unsubscribe;
  }
}
