/**
 * Firebase web settings for cloud sync. These values are meant to be public: access is
 * locked down by the Firestore rules (each account can only read and write its own data).
 * Leave apiKey empty to run the app without accounts.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyAYw08Zje1bFqaALoAXGpAxxTXlefUhWNM',
  authDomain: 'workout-app-chu.firebaseapp.com',
  projectId: 'workout-app-chu',
  appId: '1:614637021051:web:8f2d6ac1e0b08126123fde',
};

export const cloudAvailable = !!firebaseConfig.apiKey;
