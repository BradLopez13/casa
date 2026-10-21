import { View } from 'react-native';
import { t } from '@/i18n';
import { actionIcons } from '../actionIcons';
import { useTheme } from '../theme';
import { Button } from './Button';
import { ErrorText } from './ErrorText';

/**
 * Something the screen needs did not load: what happened and what to do, with «Reintentar» next
 * to it. `testID` is the message's; the button's is `${testID}.retry`.
 */
export function LoadError({
  message,
  testID,
  retrying,
  onRetry,
}: {
  message: string;
  testID: string;
  retrying: boolean;
  onRetry: () => void;
}) {
  const { space } = useTheme();
  return (
    <View style={{ gap: space(3), alignItems: 'flex-start' }}>
      <ErrorText testID={testID}>{message}</ErrorText>
      <Button
        testID={`${testID}.retry`}
        title={t('errors.retry')}
        variant="secondary"
        icon={actionIcons.retry}
        width="hug"
        loading={retrying}
        onPress={onRetry}
      />
    </View>
  );
}
