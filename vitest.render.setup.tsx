import { cleanup } from '@testing-library/react';
import { afterEach, vi } from 'vitest';

afterEach(() => {
  cleanup();
});

// The icon fonts load through expo-font, which needs the native module. An icon is decorative
// in every component (hidden from screen readers), so a test only needs it to exist.
vi.mock('@expo/vector-icons/Ionicons', () => ({
  default: ({ name }: { name: string }) => <span data-icon={name} />,
}));
