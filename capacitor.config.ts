import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.beenbys.mobile',
  appName: 'Beenby',
  webDir: 'dist/client',
  // Samma bakgrund som appen, så överscroll aldrig visar vitt/svart
  backgroundColor: '#AFA9A6',
  ios: {
    // The web UI handles safe areas with env(safe-area-inset-*). Letting
    // WKWebView add another native inset can restore a negative contentOffset
    // after resume and move the entire app behind the status bar.
    contentInset: 'never',
    backgroundColor: '#AFA9A6',
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#AFA9A6',
  },
};

export default config;
