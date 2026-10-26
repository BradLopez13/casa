import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { toAppError } from '@/data/supabase/errors';
import { firstInitial } from '@/domain/members/marks';
import { useSession } from '@/features/auth/SessionProvider';
import { startHouseholdCheckout, type HouseholdLicense } from '@/features/households/api';
import {
  billingEnabled,
  licenseHeadline,
  licensePrice,
  purchaseLicense,
} from '@/features/households/billing';
import { useHouseholdLicense, useMembers, useMembership } from '@/features/households/queries';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { LoadError } from '@/ui/components/LoadError';
import { ModalHeader } from '@/ui/components/ModalHeader';
import { useNotice } from '@/ui/components/Notice';
import { PinnedNote } from '@/ui/components/PinnedNote';
import { useTheme } from '@/ui/theme';
import { displayFont, displayFontBold } from '@/ui/tokens';

/** One fact of the licence: the label small and muted, the value under it. */
function Fact({ label, value, testID }: { label: string; value: string; testID?: string }) {
  const { colors } = useTheme();
  return (
    <View testID={testID} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={{ color: colors.muted, fontSize: 13 }}>{label}</Text>
      <Text style={{ color: colors.ink, fontSize: 17 }}>{value}</Text>
    </View>
  );
}

/**
 * «La licencia de esta casa» (bloque 12): one per household, monthly, paid by whoever runs it.
 * While Nido does not charge, the licence is complimentary: «Incluida por ahora», and nothing to
 * press. With billing on: its state, its price, who pays, what happens when the household is
 * handed over, and «Pagar la licencia» for whoever runs it.
 */
export default function LicenseScreen() {
  const { colors, space } = useTheme();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const notify = useNotice();
  const { userId } = useSession();
  const membership = useMembership().data;
  const householdId = membership?.householdId;
  const license = useHouseholdLicense(householdId);
  const members = useMembers(householdId).data ?? [];
  const [paying, setPaying] = useState(false);
  const isOwner = membership?.role === 'owner';

  // A database without licences answers none: the household is complimentary, as all are now.
  const shown: HouseholdLicense | null =
    license.data === undefined
      ? null
      : (license.data ?? {
          status: 'complimentary',
          paidBy: null,
          currentPeriodEnd: null,
          trialEndsAt: null,
        });
  const complimentary = shown?.status === 'complimentary';
  const price = licensePrice();
  const payer =
    shown?.paidBy == null
      ? t('license.paidByNobody')
      : shown.paidBy === userId
        ? t('license.paidByYou')
        : members.find((m) => m.userId === shown.paidBy)?.displayName;
  const canPay =
    shown !== null && !complimentary && shown.status !== 'active' && isOwner && billingEnabled();

  const pay = async () => {
    if (!householdId) return;
    setPaying(true);
    try {
      const checkout = await startHouseholdCheckout(householdId);
      if ((await purchaseLicense(checkout)) === 'unavailable') notify(t('license.checkoutLater'));
    } catch (e) {
      const code = toAppError(e).code;
      notify(
        code === 'BILLING_DISABLED'
          ? t('license.errors.BILLING_DISABLED')
          : code === 'NOT_OWNER'
            ? t('license.errors.NOT_OWNER')
            : t('members.errors.UNKNOWN'),
      );
    } finally {
      setPaying(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} style={{ flex: 1, backgroundColor: colors.page }}>
      <View style={{ paddingLeft: insets.left, paddingRight: insets.right }}>
        <ModalHeader
          title={t('license.title')}
          step={2}
          cancel={{
            testID: 'license.back',
            label: t('license.back'),
            onPress: () => (router.canGoBack() ? router.back() : router.replace('/settings')),
          }}
        />
      </View>
      <ScrollView
        contentContainerStyle={{
          paddingTop: space(5),
          paddingBottom: space(8),
          paddingLeft: space(5) + insets.left,
          paddingRight: space(5) + insets.right,
        }}
      >
        {license.isError && !license.data ? (
          <LoadError
            testID="license.error"
            message={t('license.loadError')}
            retrying={license.isFetching}
            onRetry={() => void license.refetch()}
          />
        ) : membership && shown ? (
          <PinnedNote
            side="left"
            testID="license.note"
            pin={{ house: { initial: firstInitial(membership.householdName), active: true } }}
          >
            <View>
              <Text style={{ color: colors.muted, fontSize: 15 }}>{t('license.of')}</Text>
              <Text style={{ color: colors.ink, fontFamily: displayFontBold, fontSize: 17 }}>
                {membership.householdName}
              </Text>
            </View>
            <View style={{ height: 1, backgroundColor: colors.hairline }} />
            <Text
              testID="license.state"
              accessibilityRole="header"
              style={{ color: colors.ink, fontFamily: displayFont, fontSize: 24, lineHeight: 30 }}
            >
              {licenseHeadline(shown)}
            </Text>
            {complimentary ? (
              <Text style={{ color: colors.muted, fontSize: 15 }}>
                {t('license.complimentaryBody')}
              </Text>
            ) : (
              <>
                {price ? <Fact label={t('license.priceLabel')} value={price} /> : null}
                {payer ? (
                  <Fact testID="license.payer" label={t('license.paidByLabel')} value={payer} />
                ) : null}
                <Text style={{ color: colors.muted, fontSize: 15 }}>
                  {t('license.transferNote')}
                </Text>
                {isOwner ? null : (
                  <Text style={{ color: colors.muted, fontSize: 15 }}>
                    {t('license.ownerPays')}
                  </Text>
                )}
              </>
            )}
          </PinnedNote>
        ) : null}
      </ScrollView>
      {/* The one action, at the foot in pósit, only for whoever runs the household. */}
      {canPay ? (
        <View
          style={{
            paddingHorizontal: space(5) + insets.left,
            paddingTop: space(3),
            paddingBottom: space(4),
            borderTopWidth: 1,
            borderTopColor: colors.hairline,
          }}
        >
          <Button
            testID="license.pay"
            title={t('license.pay')}
            width="full"
            loading={paying}
            onPress={() => void pay()}
          />
        </View>
      ) : null}
    </SafeAreaView>
  );
}
