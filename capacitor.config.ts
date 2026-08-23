import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.bloom.study',
  appName: 'Bloom',
  webDir: 'frontend',
  server: {
    androidScheme: 'https'
  }
};

export default config;
