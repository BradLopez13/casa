import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { t } from '@/i18n';
import { Button } from '@/ui/components/Button';
import { ErrorText } from '@/ui/components/ErrorText';
import { useTheme } from '@/ui/theme';
import { taskErrorMessage } from './errors';

type Props = { query: UseQueryResult<unknown>; empty: ReactNode };

/** What a task list shows when it has nothing to list: loading, a load error, or empty. */
export function TaskListStates({ query, empty }: Props) {
  const { colors, space } = useTheme();
  if (query.isPending) {
    return (
      <View style={{ paddingVertical: space(6), alignItems: 'center' }}>
        <ActivityIndicator color={colors.muted} accessibilityLabel={t('members.loading')} />
      </View>
    );
  }
  if (query.isError) {
    return (
      <View style={{ gap: space(3) }}>
        <ErrorText>{taskErrorMessage(query.error)}</ErrorText>
        <Button
          title={t('errors.retry')}
          variant="secondary"
          loading={query.isFetching}
          onPress={() => void query.refetch()}
        />
      </View>
    );
  }
  return <>{empty}</>;
}
