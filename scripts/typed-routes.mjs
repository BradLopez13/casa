// Writes Expo Router's typed routes (`.expo/types/router.d.ts`) from `app/` without starting Metro,
// so `pnpm typecheck` checks the same routes here and in CI. `expo start` writes the same file;
// before this, a stale one (ignored by git) made tsc fail on a computer and pass in CI.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const require = createRequire(path.join(root, 'package.json'));
const typesDirectory = path.join(root, '.expo', 'types');

// Typed routes run in Node with no Metro: they read the app root from the environment.
process.env.EXPO_ROUTER_APP_ROOT = path.join(root, 'app');
mkdirSync(typesDirectory, { recursive: true });
const typedRoutes = require(
  require.resolve('@expo/router-server/build/typed-routes', {
    paths: [path.dirname(require.resolve('expo-router/package.json'))],
  }),
);
typedRoutes.regenerateDeclarations(typesDirectory, {});
