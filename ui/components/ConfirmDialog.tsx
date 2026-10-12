import { useState } from 'react';
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
  const { colors, radii, space } = useTheme();
  // Keep the last content while the Modal fades out, so it doesn't blank or flash "¿Expulsar a ?".
  const live = { title, message, confirmLabel, destructive };
  const [content, setContent] = useState(live);
  if (
    visible &&
    (content.title !== title ||
      content.message !== message ||
      content.confirmLabel !== confirmLabel ||
      content.destructive !== destructive)
  ) {
    setContent(live);
  }
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
          backgroundColor: colors.scrim,
        }}
      >
        <View
          accessibilityViewIsModal
          style={{
            // A readable card on a tablet too, instead of a dialog stretched edge to edge.
            width: '100%',
            maxWidth: 440,
            alignSelf: 'center',
            gap: space(2),
            padding: space(6),
            borderRadius: radii.door,
            backgroundColor: colors.note,
          }}
        >
          <Text
            accessibilityRole="header"
            style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}
          >
            {content.title}
          </Text>
          <Text style={{ color: colors.ink, fontSize: 17, lineHeight: 24 }}>{content.message}</Text>
          {/* The answer sits apart from the question. */}
          <View style={{ gap: space(3), marginTop: space(4) }}>
            <Button
              testID="members.confirm"
              title={content.confirmLabel}
              variant={content.destructive ? 'danger' : 'primary'}
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
      </View>
    </Modal>
  );
}
