import { render, screen } from '@testing-library/react';
import { Text } from 'react-native';
import { describe, expect, it } from 'vitest';
import { PinnedNote } from './PinnedNote';

describe('PinnedNote', () => {
  it('holds its content with a member magnet that the reader skips', () => {
    render(
      <PinnedNote testID="note" pin={{ mark: { initial: 'A', color: 'teal' } }} side="left">
        <Text>Ana</Text>
      </PinnedNote>,
    );
    const note = screen.getByTestId('note');
    expect(note.textContent).toContain('Ana');
    expect(note.textContent).toContain('A');
  });

  it('hangs a glyph magnet from the top edge', () => {
    render(
      <PinnedNote testID="room" pin={{ glyph: 'shower-head' }} side="top" paper="task">
        <Text>Baño</Text>
      </PinnedNote>,
    );
    expect(screen.getByTestId('room').querySelector('[data-icon="shower-head"]')).not.toBeNull();
  });
});
