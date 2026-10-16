import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { visibleProviders, type SocialProvider } from './providers';

const asString = (value: unknown) => (typeof value === 'string' ? value : undefined);

/** The social providers shown on this device, from the EXPO_PUBLIC_AUTH_* switches. */
export function enabledProviders(): SocialProvider[] {
  // Read each variable by its full name so Expo inlines it; typed unknown because CI has no
  // generated env types.
  const google: unknown = process.env.EXPO_PUBLIC_AUTH_GOOGLE;
  const apple: unknown = process.env.EXPO_PUBLIC_AUTH_APPLE;
  return visibleProviders({
    env: { google: asString(google), apple: asString(apple) },
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    inExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
  });
}
