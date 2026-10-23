import { useRouter } from 'expo-router';
import { t } from '@/i18n';
import { actionIcons } from '@/ui/actionIcons';
import { Button } from '@/ui/components/Button';

/** An entry of «Cómo funciona Nido» (`app/help.tsx`, `HELP_ITEMS`). */
export type HelpEntry = 'write' | 'tabs' | 'shopping';

/**
 * «¿Cómo funciona?» under an empty state: one quiet tertiary line that opens the help on the entry
 * this screen raises, so help is found where it is needed and not only in Ajustes (fase 10d).
 */
export function HelpLink({ entry, testID }: { entry: HelpEntry; testID: string }) {
  const router = useRouter();
  return (
    <Button
      testID={testID}
      title={t('help.link')}
      icon={actionIcons.help}
      variant="tertiary"
      width="hug"
      flush
      onPress={() => router.push(`/help?entry=${entry}`)}
    />
  );
}
