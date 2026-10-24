import { describe, expect, it } from 'vitest';
import { t } from '@/i18n';
import { invalidFieldError, saveErrorText } from './taskFormText';

describe('saveErrorText', () => {
  it('asks for the title when it is empty', () => {
    expect(saveErrorText('INVALID_TITLE')).toBe('Escribe qué hay que hacer');
  });

  it('keeps the existing message for a repeat without a date', () => {
    expect(saveErrorText('RECURRENCE_NEEDS_DATE')).toBe('Una tarea que se repite necesita fecha.');
  });
});

describe('invalidFieldError', () => {
  it('says which property cannot be saved and which picker fixes it', () => {
    expect(invalidFieldError('assigneeId')).toEqual({
      text: t('tasks.errors.INVALID_ASSIGNEE'),
      open: 'assignee',
    });
    expect(invalidFieldError('room')).toEqual({
      text: t('tasks.errors.INVALID_ROOM'),
      open: 'room',
    });
    expect(invalidFieldError('recurrence')).toEqual({
      text: t('tasks.errors.INVALID_RECURRENCE'),
      open: 'repeat',
    });
  });

  it('says something even for a field it does not know, rather than nothing', () => {
    expect(invalidFieldError('other')).toEqual({ text: t('tasks.errors.UNKNOWN'), open: null });
  });
});
