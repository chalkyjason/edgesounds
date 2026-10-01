import { Capacitor } from '@capacitor/core'

/** True inside the iPhone app's web view; false in every browser. */
export function isNativeApp(): boolean {
  return Capacitor.isNativePlatform()
}
