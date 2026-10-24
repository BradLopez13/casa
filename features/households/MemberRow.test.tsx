import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { t } from '@/i18n';
import type { Member } from './api';
import { MemberRow } from './MemberRow';

const bo: Member = { userId: 'bo', displayName: 'Bo', role: 'member', joinedAt: '2026-10-02' };

function renderRow({ canManage = true, isSelf = false } = {}) {
  const onMakeOwner = vi.fn();
  const onRemove = vi.fn();
  render(
    <MemberRow
      member={bo}
      mark={{ color: 'teal', initial: 'B' }}
      isSelf={isSelf}
      canManage={canManage}
      onMakeOwner={onMakeOwner}
      onRemove={onRemove}
    />,
  );
  return { onMakeOwner, onRemove };
}

describe('MemberRow', () => {
  it('keeps handing over and removing behind «⋯», not on the card (fase 10a)', () => {
    renderRow();
    expect(screen.queryByTestId('members.remove.bo')).toBeNull();
    expect(screen.queryByTestId('members.make-owner.bo')).toBeNull();
    const more = screen.getByTestId('members.menu.bo');
    expect(more.getAttribute('aria-label')).toBe(t('members.more', { name: 'Bo' }));
  });

  it('opens a menu with both actions, each calling its own', () => {
    const { onMakeOwner, onRemove } = renderRow();
    fireEvent.click(screen.getByTestId('members.menu.bo'));
    expect(screen.getByRole('menu')).toBeTruthy();
    expect(screen.getAllByRole('menuitem')).toHaveLength(2);
    fireEvent.click(screen.getByTestId('members.remove.bo'));
    expect(onRemove).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId('members.menu.bo'));
    fireEvent.click(screen.getByTestId('members.make-owner.bo'));
    expect(onMakeOwner).toHaveBeenCalledTimes(1);
  });

  it('shows no «⋯» on your own card or to someone who does not run the household', () => {
    renderRow({ isSelf: true });
    expect(screen.queryByTestId('members.menu.bo')).toBeNull();
  });

  it('shows no «⋯» when the viewer cannot manage', () => {
    renderRow({ canManage: false });
    expect(screen.queryByTestId('members.menu.bo')).toBeNull();
  });
});
