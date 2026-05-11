import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uipair.app',
  appName: 'UiPair',
  webDir: 'dist',
  server: {
    // Loads your live UiPair web app inside the native shell.
    // Updates to the web app appear instantly without resubmitting to the stores.
    // To bundle offline assets instead, remove `url` and run `bun run build` before `cap sync`.
    url: 'https://uipair.com',
    cleartext: false,
  },
  ios: {
    contentInset: 'always',
  },
  android: {
    backgroundColor: '#1C1847',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1500,
      backgroundColor: '#1C1847',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      backgroundColor: '#1C1847',
    },
  },
};

export default config;
