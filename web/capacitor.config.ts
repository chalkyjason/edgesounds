import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.armyjay.app',
  appName: 'Callsign FPV',
  // Never dist/: dist-ios/ is the build with the library trimmed for the App Store.
  webDir: 'dist-ios',
  backgroundColor: '#09090b',
  ios: {
    // The page handles its own safe areas (see index.css).
    contentInset: 'never',
  },
}

export default config
