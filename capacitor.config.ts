import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.beenbys.mobile',
  appName: 'Beenby',
  webDir: 'dist/client',
  // Samma bakgrund som appen, så överscroll aldrig visar vitt/svart
  backgroundColor: '#AFA9A6',
  ios: {
    // Scrolling remains web-controlled. The StatusBar plugin below owns the
    // top system inset by placing WKWebView below the iOS status bar.
    contentInset: 'never',
    backgroundColor: '#AFA9A6',
    scrollEnabled: true,
  },
  android: {
    backgroundColor: '#AFA9A6',
  },
  plugins: {
    StatusBar: {
      // One central strategy: iOS reserves the status-bar/Dynamic-Island area.
      // Web content must therefore not add a second native top inset.
      overlaysWebView: false,
      style: 'DEFAULT',
      backgroundColor: '#AFA9A6',
    },
  },
};

export default config;
