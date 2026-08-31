import { Share } from 'react-native';

/**
 * Hands the OS share sheet a message inviting somebody to an online table.
 *
 * `Share` from react-native, not `expo-sharing`: the latter only shares FILES (it is what
 * the replayer's video export uses), and this is text. WhatsApp, Messages, mail and the rest
 * all come for free from the system sheet.
 *
 * No deep link yet, deliberately. A `upk://` scheme link only works for somebody who already
 * has the app, and an https one needs a /join/:code page on the API to bounce through — both
 * worth doing, neither needed to stop people retyping four digits by hand, which is what
 * this is for.
 *
 * Rejections are swallowed: the user dismissing the sheet is not an error, and there is
 * nothing useful to say if the platform has no share target.
 */
export async function shareTableCode(message: string): Promise<void> {
  try {
    await Share.share({ message });
  } catch {
    // Dismissed, or no share target — either way there is nothing to report.
  }
}
