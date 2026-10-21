import 'react-native-url-polyfill/auto';
import './crypto-polyfill';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { secureStore } from '../secure-store';
import { createChunkedStorage } from './chunked-storage';
import { missingConfig } from './config';
import { withTimeout } from './fetchWithTimeout';
import type { Database } from './database.types';

// Typed as unknown: CI has no generated env types, so these read as any there.
const rawUrl: unknown = process.env.EXPO_PUBLIC_SUPABASE_URL;
const rawKey: unknown = process.env.EXPO_PUBLIC_SUPABASE_KEY;
const url = typeof rawUrl === 'string' ? rawUrl : undefined;
const key = typeof rawKey === 'string' ? rawKey : undefined;

/**
 * The variables this build lacks (copy .env.example to .env and fill them in). The root layout
 * shows the start-up screen instead of the app when it is not empty, so nothing calls the
 * placeholder client below.
 */
export const configProblem = missingConfig({ url, key });

export const supabase = createClient<Database>(
  url || 'https://invalid.localhost',
  key || 'missing',
  {
    auth: {
      storage: createChunkedStorage(secureStore),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
      flowType: 'pkce',
    },
    // A request with no answer in 15 s fails as NETWORK instead of spinning for ever.
    global: { fetch: withTimeout(fetch) },
  },
);

// Refresh the session only while the app is in the foreground (Supabase
// recommendation for React Native). Registered once, at module load.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
