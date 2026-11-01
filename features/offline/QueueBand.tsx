import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutationState, useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { useIsOnline } from '@/data/query/online';
import { markOnline } from '@/data/query/retry';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';
import { queueBand } from './queueBandState';
import { isUnsentChange } from './unsent';

/**
 * The queue's band under the door, with a connection (bloque 13, P3-1): «Enviando…» while changes
 * made offline are still going out, and «No se pudo enviar.» with «Reintentar» when one keeps
 * failing. Offline, `OfflineBand` speaks instead.
 */
export function QueueBand({ testID = 'queue.band' }: { testID?: string }) {
  const { colors, space } = useTheme();
  const queryClient = useQueryClient();
  const online = useIsOnline();
  const changes = useMutationState({
    filters: { predicate: isUnsentChange },
    select: (m) => ({ failureCount: m.state.failureCount }),
  });
  const state = queueBand(online, changes);
  if (state === 'none') return null;
  const label = t(state === 'stuck' ? 'queue.stuck' : 'queue.sending');
  return (
    <View
      testID={testID}
      style={{
        flexDirection: 'row',
        flexWrap: 'wrap',
        alignItems: 'center',
        justifyContent: 'center',
        columnGap: space(2),
        paddingHorizontal: space(5),
        paddingVertical: state === 'stuck' ? 0 : space(2),
      }}
    >
      <View
        accessible
        accessibilityLabel={label}
        aria-live="polite"
        style={{ flexDirection: 'row', alignItems: 'center', gap: space(2), flexShrink: 1 }}
      >
        <Ionicons
          name={state === 'stuck' ? 'cloud-offline-outline' : 'cloud-upload-outline'}
          size={16}
          color={colors.muted}
        />
        <Text style={{ flexShrink: 1, color: colors.muted, fontSize: 14, fontWeight: '600' }}>
          {label}
        </Text>
      </View>
      {state === 'stuck' ? (
        <Button
          testID={`${testID}.retry`}
          title={t('queue.retry')}
          variant="tertiary"
          width="hug"
          onPress={() => {
            // The next tries go every second again, as just after the connection came back.
            markOnline();
            void queryClient.resumePausedMutations();
          }}
        />
      ) : null}
    </View>
  );
}
