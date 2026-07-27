import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { VisitLogForm } from '@/components/VisitLogForm';
import { deleteVisitLog, getVisitLog, updateVisitLog } from '@/data/cairns';
import { colors } from '@/theme';
import { VisitLog, VisitLogInput } from '@/types/cairn';

export default function EditVisitLog() {
  const { id, visitId } = useLocalSearchParams<{ id: string; visitId: string }>();
  const [visitLog, setVisitLog] = useState<VisitLog | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id || !visitId) return;
      getVisitLog(id, visitId).then(setVisitLog);
    }, [id, visitId]),
  );

  async function submit(input: VisitLogInput) {
    if (!id || !visitId) return;
    await updateVisitLog(id, visitId, input);
    router.replace(`/cairn/${id}`);
  }

  async function remove() {
    if (!id || !visitId) return;
    await deleteVisitLog(id, visitId);
    router.replace(`/cairn/${id}`);
  }

  if (!visitLog) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
        <Text>Loading visit...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Edit Visit' }} />
      <VisitLogForm initial={visitLog} submitLabel="Save Visit" onSubmit={submit} onDelete={remove} />
    </>
  );
}
