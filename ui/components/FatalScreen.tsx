import { ScrollView, Text } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { t } from '@/i18n';
import { actionIcons } from '../actionIcons';
import { useTheme } from '../theme';
import { Button } from './Button';
import { NidoSymbol } from './NidoSymbol';

type Props = {
  /** `crash`: something broke while running. `config`: the build is missing its setup. */
  kind: 'crash' | 'config';
  onRetry?: () => void;
  /** What went wrong, shown in development builds only. */
  detail?: string;
};

/**
 * The last screen: shown instead of the app when it cannot go on. It needs no provider, no
 * query and no loaded font, since any of those may be what failed. Slate band and chalk, the
 * same in both themes, like the sign-in band.
 */
export function FatalScreen({ kind, onRetry, detail }: Props) {
  const { colors, space } = useTheme();
  return (
    <SafeAreaProvider>
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.brandBand }}>
        <ScrollView
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: 'center',
            alignItems: 'center',
            gap: space(4),
            padding: space(6),
          }}
        >
          <NidoSymbol size={72} onSlate />
          <Text
            accessibilityRole="header"
            style={{
              color: colors.onBrandBand,
              fontSize: 24,
              fontWeight: '800',
              textAlign: 'center',
            }}
          >
            {t(kind === 'crash' ? 'fatal.crash.title' : 'fatal.config.title')}
          </Text>
          <Text
            style={{ color: colors.onBrandBand, fontSize: 16, textAlign: 'center', maxWidth: 420 }}
          >
            {t(kind === 'crash' ? 'fatal.crash.body' : 'fatal.config.body')}
          </Text>
          {kind === 'crash' && onRetry ? (
            <Button title={t('fatal.crash.retry')} icon={actionIcons.retry} onPress={onRetry} />
          ) : null}
          {__DEV__ && detail ? (
            <Text
              selectable
              style={{ color: colors.onBrandBandMuted, fontFamily: 'monospace', fontSize: 12 }}
            >
              {detail}
            </Text>
          ) : null}
        </ScrollView>
      </SafeAreaView>
    </SafeAreaProvider>
  );
}
