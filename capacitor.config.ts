import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Android app (APK). It opens the live site, so every deploy reaches the APK too with no rebuild;
 * the service worker keeps it working offline once it has loaded. The APK has its own fixed icon
 * (assets/icon-*.png); the web app's theme-matched icons don't apply to it.
 */
const config: CapacitorConfig = {
  appId: 'io.github.uzairsohail.workout',
  appName: 'Workout',
  webDir: 'dist',
  server: {
    url: 'https://uzairsohail.github.io/Workout_app/',
    androidScheme: 'https',
  },
  android: {
    backgroundColor: '#0c0c0c',
  },
};

export default config;
