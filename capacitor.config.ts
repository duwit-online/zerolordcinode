// capacitor.config.ts

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cinode',
  appName: 'Cinode',
  webDir: 'dist',

  android: {
    allowMixedContent: true,
  },

  ios: {
    contentInset: 'always',
  },
};

export default config;
