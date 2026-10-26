import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { MemberMark } from '@/domain/members/marks';
import type { Member, Membership } from '@/features/households/api';
import { membershipKey } from '@/features/households/keys';
import { t } from '@/i18n';
import type { TaskInput } from '../api';
import { TaskForm } from './TaskForm';

const TODAY = '2026-10-19';
const me: Member = { userId: 'me', displayName: 'Ana', role: 'owner', joinedAt: '2026-10-01' };
const blank: TaskInput = { title: '', room: null, assigneeId: null, dueOn: null, recurrence: null };
const membership: Membership = {
  householdId: 'h',
  householdName: 'Casa',
  role: 'owner',
  rooms: ['kitchen', 'bathroom'],
};

function renderForm(props: Partial<Parameters<typeof TaskForm>[0]> = {}) {
  const onSave = vi.fn();
  const onCancel = vi.fn();
  const queryClient = new QueryClient();
  queryClient.setQueryData(membershipKey, membership);
  render(
    <QueryClientProvider client={queryClient}>
      <TaskForm
        title={t('taskForm.newTitle')}
        initial={blank}
        members={[me]}
        marks={new Map<string, MemberMark>()}
        userId="me"
        today={TODAY}
        saving={false}
        error={null}
        onCancel={onCancel}
        onSave={onSave}
        isNew
        {...props}
      />
    </QueryClientProvider>,
  );
  return { onSave, onCancel };
}

/** The window at `width` × `height`: react-native-web measures the document element. */
function windowSize(width: number, height: number) {
  const root = document.documentElement;
  Object.defineProperty(root, 'clientWidth', { value: width, configurable: true });
  Object.defineProperty(root, 'clientHeight', { value: height, configurable: true });
  act(() => {
    window.dispatchEvent(new Event('resize'));
  });
}

const titleField = () => screen.getByTestId<HTMLInputElement>('task-form.title');
const save = () => fireEvent.click(screen.getByTestId('task-form.save'));

describe('TaskForm', () => {
  it('saves a new task with what its title says', () => {
    const { onSave } = renderForm();
    fireEvent.change(titleField(), { target: { value: 'Fregar mañana' } });
    save();
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSave.mock.calls[0]?.[0]).toMatchObject({ dueOn: '2026-10-20' });
  });

  it('says why it cannot save a person who is not an id, instead of doing nothing', () => {
    const { onSave } = renderForm({ initial: { ...blank, assigneeId: 'bo' } });
    fireEvent.change(titleField(), { target: { value: 'Fregar' } });
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('task-form.error').textContent).toContain(
      t('tasks.errors.INVALID_ASSIGNEE'),
    );
  });

  it('keeps Save dimmed until a new task has a title, and tells the reader why', () => {
    const { onSave } = renderForm();
    const button = screen.getByTestId('task-form.save');
    expect(button.getAttribute('aria-disabled')).toBe('true');
    expect(button.getAttribute('aria-label')).toBe(
      `${t('taskForm.save')}. ${t('taskForm.titleRequired')}`,
    );
    save();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(titleField(), { target: { value: 'Barrer' } });
    expect(screen.getByTestId('task-form.save').getAttribute('aria-disabled')).not.toBe('true');
  });

  it('keeps Save dimmed on an edited task whose title was cleared', () => {
    const initial: TaskInput = { ...blank, title: 'Barrer', dueOn: '2026-10-25' };
    renderForm({ initial, isNew: false, title: t('taskForm.editTitle') });
    fireEvent.change(titleField(), { target: { value: '' } });
    expect(screen.getByTestId('task-form.save').getAttribute('aria-disabled')).toBe('true');
  });

  // Bloque 11 (11.5): on a phone on its side the sheet left room for the title and one property.
  it('on a short window lays the title and the properties side by side', () => {
    windowSize(817, 375);
    renderForm({ initial: { ...blank, title: 'Barrer' } });
    expect(getComputedStyle(screen.getByTestId('task-form.columns')).flexDirection).toBe('row');
    // The open picker takes the whole width, under both columns: a week of days fits in a row.
    fireEvent.click(screen.getByTestId('task-form.prop.due'));
    const after = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(
      after(screen.getByTestId('task-form.prop.repeat'), screen.getByTestId('task-form.due.none')),
    ).toBe(true);
    windowSize(400, 860);
  });

  it('upright keeps them one under the other', () => {
    windowSize(400, 860);
    renderForm({ initial: { ...blank, title: 'Barrer' } });
    expect(getComputedStyle(screen.getByTestId('task-form.columns')).flexDirection).not.toBe('row');
  });

  it('says why a task that repeats has no «Sin fecha»', () => {
    renderForm({
      initial: {
        ...blank,
        title: 'Regar',
        dueOn: TODAY,
        recurrence: { kind: 'interval', every: 2 },
      },
    });
    fireEvent.click(screen.getByTestId('task-form.prop.due'));
    expect(screen.getByTestId('task-form.due.none').getAttribute('aria-disabled')).toBe('true');
    expect(screen.getByTestId('task-form.due.none-why').textContent).toBe(
      t('taskForm.noneNeedsDate'),
    );
  });

  it('keeps an edited task as it was apart from what was changed', () => {
    const initial: TaskInput = { ...blank, title: 'Barrer mañana', dueOn: '2026-10-25' };
    const { onSave } = renderForm({ initial, isNew: false, title: t('taskForm.editTitle') });
    // Editing never reads the title: «mañana» stays in it and the date stays as it was.
    fireEvent.change(titleField(), { target: { value: 'Barrer mañana el salón' } });
    save();
    expect(onSave).toHaveBeenCalledWith({ ...initial, title: 'Barrer mañana el salón' });
  });

  it('keeps Save quiet on an edited task until something changes', () => {
    const initial: TaskInput = { ...blank, title: 'Barrer', dueOn: '2026-10-25' };
    const { onSave } = renderForm({ initial, isNew: false, title: t('taskForm.editTitle') });
    save();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.change(titleField(), { target: { value: 'Barrer el salón' } });
    save();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('lets a new task save as soon as it has a title', () => {
    const { onSave } = renderForm({ initial: { ...blank, title: 'Barrer' } });
    save();
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows the save error it is given, and the footer and danger zone', () => {
    renderForm({
      isNew: false,
      initial: { ...blank, title: 'Barrer' },
      error: 'No se pudo guardar.',
      footer: <span>pie</span>,
      dangerZone: <span>borrar</span>,
    });
    expect(screen.getByRole('alert').textContent).toBe('No se pudo guardar.');
    expect(screen.getByText('pie')).toBeTruthy();
    expect(screen.getByText('borrar')).toBeTruthy();
  });

  it('does not save twice while a save is in flight', () => {
    const { onSave } = renderForm({ initial: { ...blank, title: 'Barrer' }, saving: true });
    save();
    expect(onSave).not.toHaveBeenCalled();
  });

  // Fase 10f: the properties are magnets aligned on the note, not kit pills.
  it('shows each property as a magnet with its field named over its value', () => {
    renderForm({ initial: { ...blank, title: 'Barrer', room: 'kitchen' } });
    const fields = [
      ['room', 'taskForm.roomLabel', t('rooms.kitchen')],
      ['assignee', 'taskForm.assigneeLabel', t('taskForm.nobody')],
      ['repeat', 'taskForm.repeatField', t('taskForm.noRepeat')],
    ] as const;
    for (const [field, label, value] of fields) {
      const magnet = screen.getByTestId(`task-form.prop.${field}`);
      expect(magnet.textContent).toBe(`${t(label)}${value}`);
      expect(magnet.getAttribute('aria-expanded')).toBe('false');
    }
  });

  it('fills the magnet of a property that has a value, and leaves an empty one a bare ring', () => {
    renderForm({ initial: { ...blank, title: 'Barrer', room: 'kitchen' } });
    // The disc's fill, wherever the magnet draws it inside its frame.
    const fill = (field: string) =>
      [...screen.getByTestId(`task-form.prop.${field}.disc`).querySelectorAll('div')]
        .map((node) => getComputedStyle(node).backgroundColor)
        .includes('rgb(46, 59, 65)');
    expect(fill('room')).toBe(true);
    expect(fill('repeat')).toBe(false);
  });

  it('opens a property’s picker right under its magnet, before the next one', () => {
    renderForm({ initial: { ...blank, title: 'Barrer' } });
    fireEvent.click(screen.getByTestId('task-form.prop.room'));
    expect(screen.getByTestId('task-form.prop.room').getAttribute('aria-expanded')).toBe('true');
    // Open reads by shape too: in dark `ink` and `selection` are the same chalk.
    expect(
      screen.getByTestId('task-form.prop.room').querySelector('[data-icon="chevron-up"]'),
    ).not.toBeNull();
    const picker = screen.getByTestId('task-form.room.kitchen');
    const after = (a: Element, b: Element) =>
      (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(after(screen.getByTestId('task-form.prop.room'), picker)).toBe(true);
    expect(after(picker, screen.getByTestId('task-form.prop.assignee'))).toBe(true);
  });
});
