import { ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { HouseholdsList } from '@/features/households/HouseholdsList';
import { useHouseholds, useMembership, useSwitchHousehold } from '@/features/households/queries';
import { t } from '@/i18n';
import { LoadError } from '@/ui/components/LoadError';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { ModalSheet, useModalFill } from '@/ui/components/ModalSheet';
import { useTheme } from '@/ui/theme';
import { useCloseModal } from '@/ui/useCloseModal';

/** Mounted once inside its frame, so rotating never remounts it. */
export default function HouseholdsRoute() {
  return (
    <ModalSheet>
      <HouseholdsSheet />
    </ModalSheet>
  );
}

/**
 * «Tus casas», opened from the household's name on the door (bloque 12, decisión 1 (A)): pick
 * the household the phone shows, create another or join one with a link.
 */
function HouseholdsSheet() {
  const { colors, space } = useTheme();
  const { fill, edges } = useModalFill();
  const close = useCloseModal('/today');
  const households = useHouseholds();
  const activeId = useMembership().data?.householdId;
  const switchTo = useSwitchHousehold();
  return (
    <SafeAreaView edges={edges} style={[fill, { backgroundColor: colors.page }]}>
      <ModalHeader
        title={t('households.title')}
        step={2}
        cancel={{ testID: 'households.close', label: t('households.close'), onPress: close }}
      />
      <ScrollView
        style={fill}
        contentContainerStyle={{
          paddingHorizontal: space(5),
          paddingTop: space(4),
          paddingBottom: space(8),
        }}
      >
        {households.data ? (
          <HouseholdsList
            households={households.data}
            activeId={activeId}
            onSwitch={(id) => {
              void switchTo(id);
              close();
            }}
            onLeave={close}
          />
        ) : households.isError ? (
          <LoadError
            testID="households.error"
            message={t('households.loadError')}
            retrying={households.isFetching}
            onRetry={() => void households.refetch()}
          />
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
