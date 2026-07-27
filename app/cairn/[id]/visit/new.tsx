import { router, Stack, useLocalSearchParams } from 'expo-router';

import { VisitLogForm } from '@/components/VisitLogForm';
import { createVisitLog } from '@/data/cairns';
import { VisitLogInput } from '@/types/cairn';

export default function NewVisitLog() {
  const { id } = useLocalSearchParams<{ id: string }>();

  async function submit(input: VisitLogInput) {
    if (!id) return;
    await createVisitLog(id, input);
    router.replace(`/cairn/${id}`);
  }

  return (
    <>
      <Stack.Screen options={{ title: 'Log Visit' }} />
      <VisitLogForm submitLabel="Save Visit" onSubmit={submit} />
    </>
  );
}
