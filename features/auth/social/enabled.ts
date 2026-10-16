import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
import { visibleProviders, type SocialProvider } from './providers';

/** The social providers shown on this device, from the EXPO_PUBLIC_AUTH_* switches. */
export function enabledProviders(): SocialProvider[] {
  return visibleProviders({
    env: {
      google: process.env.EXPO_PUBLIC_AUTH_GOOGLE,
      apple: process.env.EXPO_PUBLIC_AUTH_APPLE,
    },
    platform: Platform.OS === 'ios' || Platform.OS === 'android' ? Platform.OS : 'web',
    inExpoGo: Constants.executionEnvironment === ExecutionEnvironment.StoreClient,
  });
}
