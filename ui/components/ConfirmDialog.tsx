import { Modal, Text, View } from 'react-native';
import { t } from '@/i18n';
import { useTheme } from '../theme';
import { Button } from './Button';

type Props = {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
  loading?: boolean;
};

// A custom Modal instead of Alert.alert so Maestro can tap the same testIDs on iOS and Android.
export function ConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  onConfirm,
  onCancel,
  destructive = false,
  loading = false,
}: Props) {
  const { colors, space } = useTheme();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={loading ? undefined : onCancel}
    >
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          padding: space(6),
          backgroundColor: 'rgba(0,0,0,0.5)',
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            gap: space(3),
            padding: space(5),
            borderRadius: space(3),
            backgroundColor: colors.surface,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: colors.text, fontSize: 20, fontWeight: '700' }}
          >
            {title}
          </Text>
          <Text style={{ color: colors.text, fontSize: 16 }}>{message}</Text>
          <Button
            testID="members.confirm"
            title={confirmLabel}
            variant={destructive ? 'danger' : 'primary'}
            loading={loading}
            onPress={onConfirm}
          />
          <Button
            testID="members.cancel"
            title={t('members.cancel')}
            variant="secondary"
            disabled={loading}
            onPress={onCancel}
          />
        </View>
      </View>
    </Modal>
  );
}
