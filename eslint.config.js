const { defineConfig, globalIgnores } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const tseslint = require('typescript-eslint');
const prettier = require('eslint-config-prettier/flat');
const a11y = require('eslint-plugin-react-native-a11y');

module.exports = defineConfig([
  globalIgnores([
    'data/supabase/database.types.ts',
    'ios/',
    'android/',
    '.expo/',
    '.claude/',
    'dist/',
    'expo-env.d.ts',
    'supabase/functions/send-push/',
  ]),
  expoConfig,
  {
    files: ['**/*.{ts,tsx}', 'scripts/**/*.mts'],
    extends: [tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: { projectService: true },
    },
    rules: {
      '@typescript-eslint/no-floating-promises': 'error',
    },
  },
  {
    files: ['**/*.{js,cjs,mjs}'],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
    },
  },
  // Accessibility props checked by lint (fase 10e), iOS and Android: the plugin has no
  // «recommended», so «all», its two platform sets together.
  {
    files: ['app/**/*.tsx', 'features/**/*.tsx', 'ui/**/*.tsx'],
    ignores: ['**/*.test.tsx'],
    plugins: { 'react-native-a11y': a11y },
    rules: {
      ...a11y.configs.all.rules,
      // A hint on every labelled element makes the screen reader say twice what the label says;
      // hints go only where the result is not obvious (`accessibilityHint` on the notes and the
      // quantity), as both platforms' guidelines ask.
      'react-native-a11y/has-accessibility-hint': 'off',
    },
  },
  prettier,
]);
