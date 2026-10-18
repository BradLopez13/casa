/** The Supabase settings this build is missing, by variable name; empty when it has both. */
export function missingConfig(env: { url?: string; key?: string }): string[] {
  const missing: string[] = [];
  if (!env.url) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!env.key) missing.push('EXPO_PUBLIC_SUPABASE_KEY');
  return missing;
}
