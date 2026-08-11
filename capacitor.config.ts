import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.beenbys.mobile',
  appName: 'Beenby',
  webDir: 'dist/client',
  // Samma bakgrund som appen, så överscroll aldrig visar vitt/svart
  backgroundColor: '#AFA9A6',
  ios: {
    contentInset: 'always',
    backgroundColor: '#AFA9A6',
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#AFA9A6',
  },
};

export default config;
