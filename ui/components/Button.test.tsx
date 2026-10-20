import { render } from '@testing-library/react';
import type { ComponentProps } from 'react';
import { describe, expect, it, vi } from 'vitest';
import { Button } from './Button';

// react-native-web drops `collapsable`, so the props are read where Button hands them to View.
const views = vi.hoisted(() => [] as Record<string, unknown>[]);
vi.mock('react-native', async (importOriginal) => {
  const rn = await importOriginal<typeof import('react-native')>();
  const View = (props: ComponentProps<typeof rn.View>) => {
    views.push(props as Record<string, unknown>);
    return <rn.View {...props} />;
  };
  return { ...rn, View };
});

function labelProps(disabled: boolean) {
  views.length = 0;
  render(
    <Button title="Borrar tarea" icon="trash-outline" disabled={disabled} onPress={() => {}} />,
  );
  const label = views.find(
    (props) => (props.style as { flexDirection?: string } | undefined)?.flexDirection === 'row',
  );
  if (label === undefined) throw new Error('no label view');
  return label as { collapsable?: boolean; style: { opacity: number } };
}

describe('Button', () => {
  // CASA-3: fading the label on disable un-flattened it and moved its text into a new native
  // view; Fabric on Android crashed doing that while deleting a task closed its modal.
  it('keeps the label its own native view whether it is faded or not', () => {
    const enabled = labelProps(false);
    const disabled = labelProps(true);
    expect(disabled.style.opacity).toBeLessThan(enabled.style.opacity);
    expect(enabled.collapsable).toBe(false);
    expect(disabled.collapsable).toBe(false);
  });
});
