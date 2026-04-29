import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.lovable.00a31809aafa4feaa3b72b8bfaac4ee5',
  appName: 'usmancinoderemix',
  webDir: 'dist',
  server: {
    url: 'https://00a31809-aafa-4fea-a3b7-2b8bfaac4ee5.lovableproject.com?forceHideBadge=true',
    cleartext: true,
  },
  android: { allowMixedContent: true },
  ios: { contentInset: 'always' },
};

export default config;
