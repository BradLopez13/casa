import 'react-native-url-polyfill/auto';
import './crypto-polyfill';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';
import { secureStore } from '../secure-store';
import { createChunkedStorage } from './chunked-storage';
import { missingConfig } from './config';
import type { Database } from './database.types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_KEY;

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
