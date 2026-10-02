import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';
import type { Member } from './api';

type Props = {
  member: Member;
  isSelf: boolean;
  /** Owner actions are shown only when the viewer owns the household and the row is not self. */
  canManage: boolean;
  onMakeOwner: () => void;
  onRemove: () => void;
};

export function MemberRow({ member, isSelf, canManage, onMakeOwner, onRemove }: Props) {
  const { colors, space } = useTheme();
  return (
    <View
      testID={`members.row.${member.userId}`}
      style={{
        gap: space(2),
        padding: space(4),
        borderRadius: space(2),
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
      }}
    >
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: space(2) }}>
        <Text style={{ color: colors.text, fontSize: 17, fontWeight: '600' }}>
          {member.displayName}
        </Text>
        {isSelf ? (
          <Text style={{ color: colors.muted, fontSize: 15 }}>{t('members.you')}</Text>
        ) : null}
        {member.role === 'owner' ? (
          <Text
            style={{
              color: colors.primary,
              fontSize: 13,
              fontWeight: '700',
              borderWidth: 1,
              borderColor: colors.primary,
              borderRadius: space(2),
              paddingHorizontal: space(2),
              paddingVertical: 2,
            }}
          >
            {t('members.owner')}
          </Text>
        ) : null}
      </View>
      {canManage && !isSelf ? (
        <View style={{ gap: space(2) }}>
          <Button
            testID={`members.make-owner.${member.userId}`}
            title={t('members.makeOwner')}
            variant="secondary"
            onPress={onMakeOwner}
          />
          <Button
            testID={`members.remove.${member.userId}`}
            title={t('members.remove')}
            variant="secondary"
            onPress={onRemove}
          />
        </View>
      ) : null}
    </View>
  );
}
