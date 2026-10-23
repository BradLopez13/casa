import { useQueryClient } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { memberMarks } from '@/domain/members/marks';
import {
  CATALOG,
  CATALOG_ROOMS,
  catalogFor,
  catalogId,
  catalogInputs,
  catalogLabel,
  normalizeTaskTitle,
  type CatalogItem,
  type CatalogRoom,
} from '@/domain/tasks/catalog';
import { roomIcon } from '@/domain/tasks/roomIcons';
import { ROOMS } from '@/domain/tasks/rooms';
import { useSession } from '@/features/auth/SessionProvider';
import { useDiscardGuard } from '@/features/forms/useDiscardGuard';
import { useMembers, useMembership } from '@/features/households/queries';
import { createTask, newTaskId, type TaskInput } from '@/features/tasks/api';
import { AssigneePicker } from '@/features/tasks/components/AssigneePicker';
import { SectionHeader } from '@/features/tasks/components/SectionHeader';
import { taskErrorMessage } from '@/features/tasks/errors';
import { useTaskMutation, useTasks } from '@/features/tasks/queries';
import { useToday } from '@/features/tasks/useToday';
import { t } from '@/i18n';
import { useIsOnline } from '@/data/query/online';
import { ErrorText } from '@/ui/components/ErrorText';
import { LoadError } from '@/ui/components/LoadError';
import { OfflineBand } from '@/ui/components/OfflineBand';
import { Magnet } from '@/ui/components/Magnet';
import { Button } from '@/ui/components/Button';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { PinnedNote } from '@/ui/components/PinnedNote';
import { ModalSheet, useModalFill } from '@/ui/components/ModalSheet';
import { pressedOpacity } from '@/ui/buttonLook';
import { useTheme } from '@/ui/theme';
import { MIN_TOUCH } from '@/ui/tokens';
import { useCloseModal } from '@/ui/useCloseModal';
import { useLayout } from '@/ui/useLayout';

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
  const label = catalogLabel(item);
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
        check={checked ? 'filled' : undefined}
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
  const { userId } = useSession();
  const { shortHeight } = useLayout();
  const members = useMembers(householdId).data;
  const marks = useMemo(() => memberMarks(members ?? []), [members]);
  // Who does every chosen task; nobody by default, as before.
  const [assigneeId, setAssigneeId] = useState<string | null>(null);
  const tasksQuery = useTasks(householdId);
  const tasks = tasksQuery.data;
  const online = useIsOnline();
  // Until the household's tasks are in, the catalogue cannot leave out the ones it already does:
  // it waits, rather than offering everything and then taking some back (fase 10e).
  const loadingTasks = tasks === undefined && !tasksQuery.isError;
  // A load that failed with nothing kept (a cold start offline) says so, with its retry.
  const tasksFailed = tasks === undefined && tasksQuery.isError;
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
    const picks = catalogInputs(keys, today, assigneeId).map(
      ({ id, input }): [string, TaskInput] => [ids.get(id) as string, input],
    );
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

  // «Para» sits above «Añadir»: in the foot, or on a short window (a phone on its side) at the end
  // of the list, so the foot does not take the little height the list has.
  const assignee =
    keys.length > 0 && members && members.length > 0 ? (
      <View style={{ gap: space(2), paddingBottom: space(3) }}>
        <Text style={{ color: colors.muted, fontSize: 14 }}>{t('templates.assigneeLabel')}</Text>
        <AssigneePicker
          value={assigneeId}
          members={members}
          marks={marks}
          userId={userId}
          onChange={setAssigneeId}
        />
      </View>
    ) : null;

  // Something chosen and not saved: Cancel, back and the gesture ask before dropping it.
  const { requestClose, dialog } = useDiscardGuard({
    dirty: keys.length > 0,
    onCancel: close,
    busy: saving,
  });

  return (
    <SafeAreaView edges={edges} style={[fill, { backgroundColor: colors.page }]}>
      <ModalHeader
        title={t('templates.title')}
        step={2}
        cancel={{ testID: 'templates.cancel', label: t('templates.cancel'), onPress: requestClose }}
      />
      {online ? null : <OfflineBand label={t('templates.offline')} testID="templates.offline" />}
      <ScrollView
        style={fill}
        contentContainerStyle={{
          paddingHorizontal: space(5),
          paddingTop: space(4),
          paddingBottom: space(8),
          gap: space(5),
        }}
      >
        {loadingTasks ? (
          <View style={{ paddingVertical: space(6), alignItems: 'center' }}>
            <ActivityIndicator
              testID="templates.loading"
              color={colors.muted}
              accessibilityLabel={t('common.loading')}
            />
          </View>
        ) : null}
        {tasksFailed ? (
          <LoadError
            testID="templates.load-error"
            message={taskErrorMessage(tasksQuery.error)}
            retrying={tasksQuery.isFetching}
            onRetry={() => void tasksQuery.refetch()}
          />
        ) : null}
        {(tasks === undefined ? [] : groups).map((group) => (
          // Each room is a note to choose from, held by the magnet of its room.
          <PinnedNote
            key={group.room}
            testID={`templates.room.${group.room}`}
            pin={{ glyph: roomIcon(group.room) }}
            side="top"
            paper="task"
          >
            {/* Heading and rows stay together, as before: the note's gap is for blocks. */}
            <View>
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
          </PinnedNote>
        ))}
        {tasks !== undefined && groups.length === 0 ? (
          <Text testID="templates.empty" style={{ color: colors.muted, fontSize: 16 }}>
            {t('templates.empty')}
          </Text>
        ) : null}
        {shortHeight && assignee ? assignee : null}
        {save.error ? (
          <ErrorText testID="templates.error">{taskErrorMessage(save.error)}</ErrorText>
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
        {shortHeight ? null : assignee}
        <Button
          testID="templates.add"
          title={
            failed
              ? t('templates.retry')
              : keys.length === 0
                ? // Disabled until something is chosen: it says what to do, never «Añadir 0».
                  t('templates.choose')
                : keys.length === 1
                  ? t('templates.addOne')
                  : t('templates.addCount', { n: keys.length })
          }
          onPress={add}
          // Adding many tasks at once waits for the connection; the band says so.
          disabled={keys.length === 0 || !online || tasks === undefined}
          loading={saving}
          width="full"
        />
      </View>
      {dialog}
    </SafeAreaView>
  );
}
