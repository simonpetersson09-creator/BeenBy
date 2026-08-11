import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.beenbys.mobile',
  appName: 'Beenby',
  webDir: '.output/public',
  ios: {
    contentInset: 'always',
  },
};

export default config;
