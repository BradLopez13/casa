import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { AppState, Platform } from 'react-native';
import { createChunkedStorage } from './chunked-storage';
import type { Database } from './database.types';

const url: string | undefined = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key: string | undefined = process.env.EXPO_PUBLIC_SUPABASE_KEY;

if (!url || !key) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_KEY. Copy .env.example to .env and fill both in.',
  );
}

export const supabase = createClient<Database>(url, key, {
  auth: {
    storage: createChunkedStorage(SecureStore),
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});

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
