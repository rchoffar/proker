import { Alert } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, usePreventRemove } from 'expo-router/react-navigation';

/**
 * Asks for confirmation before leaving a game screen while a game is in
 * progress. Intercepts every exit path (the header X via router.dismissTo,
 * Android hardware back, iOS edge-swipe); leaving proceeds untouched once
 * `inProgress` is false.
 */
export function useConfirmQuitGame(inProgress: boolean) {
  const navigation = useNavigation();
  const { t } = useTranslation('common');
  usePreventRemove(inProgress, ({ data }) => {
    Alert.alert(t('quitGame.title'), t('quitGame.message'), [
      { text: t('cancel'), style: 'cancel' },
      { text: t('quitGame.confirm'), style: 'destructive', onPress: () => navigation.dispatch(data.action) },
    ]);
  });
}
