import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen } from '@testing-library/react';
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

  it('does not save without a title, and says why', () => {
    const { onSave } = renderForm();
    save();
    expect(onSave).not.toHaveBeenCalled();
    expect(screen.getByTestId('task-form.error')).toBeTruthy();
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
});
