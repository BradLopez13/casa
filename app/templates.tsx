import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { recurrenceLabel } from '@/domain/recurrence/label';
import {
  CATALOG,
  CATALOG_ROOMS,
  catalogFor,
  catalogId,
  catalogInputs,
  catalogTitle,
  normalizeTaskTitle,
  type CatalogItem,
  type CatalogRoom,
} from '@/domain/tasks/catalog';
import { ROOMS } from '@/domain/tasks/rooms';
import { useMembership } from '@/features/households/queries';
import { createTask, newTaskId, type TaskInput } from '@/features/tasks/api';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { taskErrorMessage } from '@/features/tasks/errors';
import { useTaskMutation, useTasks } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { ErrorText } from '@/ui/components/ErrorText';
import { Magnet } from '@/ui/components/Magnet';
import { Button } from '@/ui/components/Button';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { ModalSheet, useModalFill } from '@/ui/components/ModalSheet';
import { pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { useCloseModal } from '@/ui/useCloseModal';

function TemplateRow({
  room,
  item,
  checked,
  onToggle,
}: {
  room: CatalogRoom;
  item: CatalogItem;
  checked: boolean;
  onToggle: () => void;
}) {
  const { colors, space } = useTheme();
  // The room is the section heading, so the row says only the chore and its repeat.
  const label = [catalogTitle(item), item.recurrence ? recurrenceLabel(item.recurrence) : null]
    .filter((part) => part !== null)
    .join(', ');
  return (
    <Pressable
      testID={`templates.item.${catalogId(room, item)}`}
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={onToggle}
      style={({ pressed }) => ({
        minHeight: MIN_TOUCH,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space(3),
        paddingVertical: space(3),
        opacity: pressedOpacity(pressed),
      })}
    >
      {/* The check mark, not only the colour, shows the selection. */}
      <Magnet
        size="sm"
        decorative
        variant="empty"
        edge="solid"
        check={checked ? 'filled' : 'faint'}
        color="teal"
        initial=""
        accessibilityLabel={label}
      />
      <Text style={{ flex: 1, color: colors.ink, fontSize: 16 }}>{label}</Text>
    </Pressable>
  );
}

/** Mounted once inside its frame, so rotating never remounts the list. */
export default function TemplatesRoute() {
  return (
    <ModalSheet>
      <TemplatesScreen />
    </ModalSheet>
  );
}

function roomHeading(room: CatalogRoom): string {
  return room === 'general' ? t('catalog.general') : t(`rooms.${room}`);
}

function TemplatesScreen() {
  const { colors, space } = useTheme();
  const { fill, edges } = useModalFill();
  const close = useCloseModal('/today');
  const today = useToday();
  const queryClient = useQueryClient();
  const membership = useMembership().data;
  const householdId = membership?.householdId;
  const tasks = useTasks(householdId).data;
  // Only what the household has rooms for and does not do yet (by normalised title). A
  // membership persisted before rooms existed has none: every room then.
  const rooms = membership?.rooms;
  const groups = useMemo(
    () =>
      catalogFor(
        rooms ?? ROOMS,
        new Set((tasks ?? []).map((task) => normalizeTaskTitle(task.title))),
      ),
    [rooms, tasks],
  );
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  // One id per catalogue entry: a retry sends the same ids, so a task created before a failure
  // comes back as itself instead of a copy.
  const [ids] = useState(
    () =>
      new Map(
        CATALOG_ROOMS.flatMap((room) =>
          CATALOG[room].map((item) => [catalogId(room, item), newTaskId()] as const),
        ),
      ),
  );
  const save = useTaskMutation(async ({ tasks }: { tasks: [string, TaskInput][] }) => {
    for (const [id, input] of tasks) {
      await createTask(id, householdId as string, input);
    }
  });

  // Once a save fails the button stays "Reintentar", also while retrying, until one succeeds.
  const [failed, setFailed] = useState(false);
  // Only the chosen entries still on offer: one created before a failed save drops out of the
  // list once the tasks refresh, and out of the count with it.
  const keys = groups.flatMap((group) =>
    group.items.map((item) => catalogId(group.room, item)).filter((key) => selected.has(key)),
  );
  const saving = save.isPending || save.isSuccess;
  const toggle = (key: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const add = () => {
    if (householdId === undefined || keys.length === 0) return;
    const picks = catalogInputs(keys, today).map(({ id, input }): [string, TaskInput] => [
      ids.get(id) as string,
      input,
    ]);
    save.submit(
      { tasks: picks },
      {
        onSuccess: close,
        onError: () => {
          setFailed(true);
          // Some tasks may already exist: refresh the list so Hoy shows them (and drops the
          // templates card) even if the user cancels instead of retrying.
          void queryClient.invalidateQueries({ queryKey: ['tasks'] });
        },
      },
    );
  };

  return (
    <SafeAreaView edges={edges} style={[fill, { backgroundColor: colors.page }]}>
      <ModalHeader
        title={t('templates.title')}
        step={2}
        cancel={{ testID: 'templates.cancel', label: t('templates.cancel'), onPress: close }}
      />
      <ScrollView
        style={fill}
        contentContainerStyle={{
          paddingHorizontal: space(5),
          paddingTop: space(3),
          paddingBottom: space(8),
        }}
      >
        {groups.map((group) => (
          <View key={group.room}>
            <SectionHeader title={roomHeading(group.room)} count={group.items.length} flush />
            {group.items.map((item) => {
              const key = catalogId(group.room, item);
              return (
                <TemplateRow
                  key={key}
                  room={group.room}
                  item={item}
                  checked={selected.has(key)}
                  onToggle={() => toggle(key)}
                />
              );
            })}
          </View>
        ))}
        {groups.length === 0 ? (
          <Text style={{ paddingTop: space(4), color: colors.muted, fontSize: 16 }}>
            {t('templates.empty')}
          </Text>
        ) : null}
        {save.error ? (
          <View style={{ paddingTop: space(4) }}>
            <ErrorText testID="templates.error">{taskErrorMessage(save.error)}</ErrorText>
          </View>
        ) : null}
      </ScrollView>
      {/* The foot, as on the task form: «Añadir» is the sheet's one pósit, under the thumb. */}
      <View
        style={{
          paddingHorizontal: space(5),
          paddingTop: space(3),
          paddingBottom: space(3),
          borderTopWidth: 1,
          borderTopColor: colors.hairline,
          backgroundColor: colors.page,
        }}
      >
        <Button
          testID="templates.add"
          title={
            failed
              ? t('templates.retry')
              : keys.length === 1
                ? t('templates.addOne')
                : t('templates.addCount', { n: keys.length })
          }
          onPress={add}
          disabled={keys.length === 0}
          loading={saving}
          width="full"
        />
      </View>
    </SafeAreaView>
  );
}
