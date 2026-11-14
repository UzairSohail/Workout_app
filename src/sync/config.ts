/**
 * Firebase web settings for cloud sync. These values are meant to be public: access is
 * locked down by the Firestore rules (each account can only read and write its own data).
 * Leave apiKey empty to run the app without accounts.
 */
export const firebaseConfig = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  appId: '',
};

export const cloudAvailable = !!firebaseConfig.apiKey;
