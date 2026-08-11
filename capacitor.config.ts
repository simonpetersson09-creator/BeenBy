import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.beenbys.mobile',
  appName: 'Beenby',
  webDir: 'dist/client',
  ios: {
    contentInset: 'always',
  },
};

export default config;
