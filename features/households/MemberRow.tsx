import { Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { Magnet } from '@/ui/components/Magnet';
import { useTheme } from '@/ui/theme';
import type { Member } from './api';

type Props = {
  member: Member;
  mark: MemberMark;
  isSelf: boolean;
  /** Owner actions are shown only when the viewer owns the household and the row is not self. */
  canManage: boolean;
  onMakeOwner: () => void;
  onRemove: () => void;
};

export function MemberRow({ member, mark, isSelf, canManage, onMakeOwner, onRemove }: Props) {
  const { colors, radii, space } = useTheme();
  return (
    <View
      testID={`members.row.${member.userId}`}
      style={{
        gap: space(3),
        padding: space(4),
        borderRadius: radii.note,
        backgroundColor: colors.note,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space(3) }}>
        {/* The name is read right after it, so the magnet itself stays silent. */}
        <Magnet
          initial={mark.initial}
          color={mark.color}
          size="md"
          accessibilityLabel={member.displayName}
          decorative
        />
        <View
          style={{
            flex: 1,
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'center',
            columnGap: space(2),
            rowGap: space(1),
          }}
        >
          <Text style={{ color: colors.ink, fontSize: 17, fontWeight: '600' }}>
            {member.displayName}
          </Text>
          {isSelf ? (
            <Text style={{ color: colors.muted, fontSize: 15 }}>{t('members.you')}</Text>
          ) : null}
          {member.role === 'owner' ? (
            <View
              style={{
                borderRadius: radii.pill,
                backgroundColor: colors.door,
                paddingHorizontal: space(3),
                paddingVertical: space(1),
              }}
            >
              <Text style={{ color: colors.ink, fontSize: 13, fontWeight: '600' }}>
                {t('members.owner')}
              </Text>
            </View>
          ) : null}
        </View>
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
