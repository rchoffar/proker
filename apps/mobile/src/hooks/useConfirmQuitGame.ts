import { useCallback, useRef } from 'react';
import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';

/** Which consequence the confirmation should warn about. */
type QuitStake =
  /** Only this device loses its progress. */
  | 'progress'
  /** This device holds the room: leaving ends the game for everyone. */
  | 'closesTable';

/**
 * Asks for confirmation before leaving a game screen while a game is in progress, and
 * returns a `confirmQuit()` for the exit paths the screen owns itself.
 *
 * Two mechanisms, deliberately:
 *
 * - `usePreventRemove` is the safety net for the paths we do not control — Android
 *   hardware back and the iOS edge-swipe.
 * - `confirmQuit()` is for the header X. The online hooks tear the room down in their
 *   effect *cleanup*, so by the time anything could show a dialog on the way out, the
 *   room is already closed for everyone. Asking before navigating is the only order that
 *   works — that is the "the ❌ ends the game even if you don't confirm" report.
 *
 * A confirmed quit sets a ref so the safety net waves the navigation through instead of
 * asking a second time.
 */
export function useConfirmQuitGame(inProgress: boolean, stake: QuitStake = 'progress') {
  const navigation = useNavigation();
  const { t } = useTranslation('common');
  const message = stake === 'closesTable' ? t('quitGame.closesTable') : t('quitGame.message');
  const confirmedRef = useRef(false);

  usePreventRemove(inProgress, ({ data }) => {
    if (confirmedRef.current) {
      navigation.dispatch(data.action);
      return;
    }
    Alert.alert(t('quitGame.title'), message, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('quitGame.confirm'),
        style: 'destructive',
        onPress: () => {
          confirmedRef.current = true;
          navigation.dispatch(data.action);
        },
      },
    ]);
  });

  return useCallback(() => {
    if (!inProgress) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      Alert.alert(
        t('quitGame.title'),
        message,
        [
          { text: t('cancel'), style: 'cancel', onPress: () => resolve(false) },
          {
            text: t('quitGame.confirm'),
            style: 'destructive',
            onPress: () => {
              confirmedRef.current = true;
              resolve(true);
            },
          },
        ],
        // Android only — an iOS alert cannot be dismissed without picking a button.
        { onDismiss: () => resolve(false) },
      );
    });
  }, [inProgress, message, t]);
}
