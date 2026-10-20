import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const alias = { '@': fileURLToPath(new URL('.', import.meta.url)) };
const exclude = [
  'node_modules',
  'e2e',
  '.claude/**',
  'supabase/migrations',
  'supabase/tests',
  'supabase/functions/send-push',
];

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: 'unit',
          include: ['**/*.test.ts', 'scripts/**/*.test.mts'],
          setupFiles: ['./vitest.setup.ts'],
          exclude,
        },
      },
      // Render tests draw the components with react-native-web in jsdom: the same tree, roles,
      // labels and testIDs the phone gets, without a device. Native-only modules are mocked in
      // vitest.render.setup.tsx.
      {
        resolve: {
          alias: { ...alias, 'react-native': 'react-native-web' },
          extensions: ['.web.tsx', '.web.ts', '.web.js', '.tsx', '.ts', '.mjs', '.js', '.json'],
        },
        define: { __DEV__: 'false' },
        test: {
          name: 'render',
          include: ['**/*.test.tsx'],
          environment: 'jsdom',
          setupFiles: ['./vitest.setup.ts', './vitest.render.setup.tsx'],
          exclude,
          // Inlined so their own `react-native` imports go through the alias too, instead of
          // Node loading the real (Flow) package.
          server: { deps: { inline: [/react-native/, /[\\/]expo/, /@expo[\\/]/] } },
        },
      },
    ],
  },
});
