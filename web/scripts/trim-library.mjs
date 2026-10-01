// Filters the sound library down to what the iPhone app may ship.
//
// An allowlist, and it fails closed: a sound is kept only if its licence is
// exactly one of ALLOWED_LICENSES. A missing or unrecognised licence is
// dropped, so a clip added to library.json without a licence can never reach
// the App Store build by accident.
//
// Plain JavaScript rather than TypeScript because its only caller is the
// build script, which Node runs directly.

export const ALLOWED_LICENSES = ['generated-original']

/**
 * @template {{ categories: Array<{ sounds: Array<{ license?: string }> }> }} T
 * @param {T} library the parsed library.json
 * @returns {T} a copy without disallowed sounds or the categories they emptied
 */
export function trimLibrary(library) {
  if (!library || !Array.isArray(library.categories)) {
    throw new Error('library.json has no categories array')
  }
  const categories = library.categories
    .map((category) => ({
      ...category,
      sounds: (category.sounds ?? []).filter((sound) => ALLOWED_LICENSES.includes(sound.license)),
    }))
    .filter((category) => category.sounds.length > 0)
  return { ...library, categories }
}
