import { describe, expect, it } from 'vitest';
import { missingConfig } from './config';

describe('missingConfig', () => {
  it('is empty when both values are there', () => {
    expect(missingConfig({ url: 'https://x.supabase.co', key: 'k' })).toEqual([]);
  });

  it('names the URL when it is missing', () => {
    expect(missingConfig({ key: 'k' })).toEqual(['EXPO_PUBLIC_SUPABASE_URL']);
  });

  it('names the key when it is missing', () => {
    expect(missingConfig({ url: 'https://x.supabase.co' })).toEqual(['EXPO_PUBLIC_SUPABASE_KEY']);
  });

  it('names both when both are missing', () => {
    expect(missingConfig({})).toEqual(['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_KEY']);
  });

  it('counts an empty value as missing', () => {
    expect(missingConfig({ url: '', key: '' })).toEqual([
      'EXPO_PUBLIC_SUPABASE_URL',
      'EXPO_PUBLIC_SUPABASE_KEY',
    ]);
  });
});
