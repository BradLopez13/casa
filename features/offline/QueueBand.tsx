import Ionicons from '@expo/vector-icons/Ionicons';
import { useQueryClient } from '@tanstack/react-query';
import { Text, View } from 'react-native';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { useTheme } from '@/ui/theme';
import { queueMonitorOf, useQueueSnapshot } from './useQueue';

/**
 * The queue's band under the door, with a connection (bloque 13, P3-1): «Enviando…» while a change
 * that had to wait is still going out, and «No se pudo enviar.» with «Reintentar» once nothing
 * went out for 30 s (bloque 14.1, decisión 2 A; `queueMonitor`). «Reintentar» tries every queue
 * again at once. Offline, `OfflineBand` speaks instead.
 */
export function QueueBand({ testID = 'queue.band' }: { testID?: string }) {
  const { colors, space } = useTheme();
  const queryClient = useQueryClient();
  const state = useQueueSnapshot().band;
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
          onPress={() => queueMonitorOf(queryClient).retryNow()}
        />
      ) : null}
    </View>
  );
}
