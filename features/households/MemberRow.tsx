import { Text, View } from 'react-native';
import type { MemberMark } from '@/domain/members/marks';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';
import { PinnedNote } from '@/ui/components/PinnedNote';
import { useTheme } from '@/ui/theme';
import { displayFontBold } from '@/ui/tokens';
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
  const { colors, space } = useTheme();
  return (
    // A member is a note held by their magnet, as a task is: the magnet bites its left edge.
    <PinnedNote testID={`members.row.${member.userId}`} pin={{ mark }} side="left">
      <View style={{ gap: space(1) }}>
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            alignItems: 'baseline',
            columnGap: space(2),
          }}
        >
          <Text style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 18 }}>
            {member.displayName}
          </Text>
          {isSelf ? (
            <Text style={{ color: colors.muted, fontSize: 15 }}>{t('members.you')}</Text>
          ) : null}
        </View>
        {/* Who runs the household is a line under the name, not a badge. */}
        {member.role === 'owner' ? (
          <Text
            testID={`members.owner.${member.userId}`}
            style={{ color: colors.muted, fontSize: 14 }}
          >
            {t('members.owner')}
          </Text>
        ) : null}
      </View>
      {canManage && !isSelf ? (
        // Side by side when they fit; on a phone they wrap, and each already has a 44 dp target,
        // so the lines need no extra gap to stay apart.
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: space(5) }}>
          <Button
            testID={`members.make-owner.${member.userId}`}
            title={t('members.makeOwner')}
            variant="tertiary"
            icon={actionIcons.makeOwner}
            width="hug"
            flush
            onPress={onMakeOwner}
          />
          <Button
            testID={`members.remove.${member.userId}`}
            title={t('members.remove')}
            variant="tertiary"
            tone="destructive"
            icon={actionIcons.removeMember}
            width="hug"
            flush
            onPress={onRemove}
          />
        </View>
      ) : null}
    </PinnedNote>
  );
}
