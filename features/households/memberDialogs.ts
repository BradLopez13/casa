import type { MessageKey } from '@/i18n';

/** The confirmation a members screen action waits for. */
export type Pending = { kind: 'remove' | 'transfer' | 'leave' | 'delete'; userId?: string };

export const DIALOGS: Record<
  Pending['kind'],
  { title: MessageKey; message: MessageKey; action: MessageKey }
> = {
  remove: {
    title: 'members.confirm.removeTitle',
    message: 'members.confirm.removeMessage',
    action: 'members.confirm.removeAction',
  },
  transfer: {
    title: 'members.confirm.transferTitle',
    message: 'members.confirm.transferMessage',
    action: 'members.confirm.transferAction',
  },
  leave: {
    title: 'members.confirm.leaveTitle',
    message: 'members.confirm.leaveMessage',
    action: 'members.confirm.leaveAction',
  },
  delete: {
    title: 'members.confirm.deleteTitle',
    message: 'members.confirm.deleteMessage',
    action: 'members.confirm.deleteAction',
  },
};
