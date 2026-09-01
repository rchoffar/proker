import { useCallback } from 'react';
import { useRouter } from 'expo-router';

/**
 * The two ways out of a play screen, so every game agrees on what they mean.
 *
 * - `back()` goes UP ONE LEVEL — to the game's own setup screen, since the only route into a
 *   game is `/ → /games/x → /games/x/play` on a flat stack. That is where you want to land
 *   after a game: the roster is still there, so running it back is one tap instead of
 *   walking in from the home screen again.
 * - `home()` goes to the home screen, popping the whole stack rather than pushing a second
 *   copy of it.
 *
 * Both take the screen's own `confirm` — the header X and the HOME button are equally a way
 * of abandoning a game in progress, and `usePreventRemove` intercepts the back path too, so
 * skipping the confirm on either one gets the question asked twice.
 */
export function useGameExit(confirm: () => Promise<boolean>) {
  const router = useRouter();

  const back = useCallback(async () => {
    if (await confirm()) router.back();
  }, [confirm, router]);

  const home = useCallback(async () => {
    if (await confirm()) router.dismissTo('/');
  }, [confirm, router]);

  return { back, home };
}
