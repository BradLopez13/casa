import { useLocalSearchParams } from 'expo-router';
import { NewHouseholdFlow } from '@/features/households/NewHouseholdFlow';

/**
 * «Crear otra casa» and «Unirme con un enlace» (bloque 12): onboarding's screen for someone who
 * already has a household, with «Volver». `?join=1` opens it on the link field.
 */
export default function NewHouseholdScreen() {
  const { join } = useLocalSearchParams<{ join?: string }>();
  return <NewHouseholdFlow another focusLink={join === '1'} />;
}
