import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.cinode',
  appName: 'Cinode',
  webDir: 'dist',
  server: {
    url: 'https://00a31809-aafa-4fea-a3b7-2b8bfaac4ee5.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: { allowMixedContent: true },
  ios: { contentInset: 'always' },
};

export default config;
