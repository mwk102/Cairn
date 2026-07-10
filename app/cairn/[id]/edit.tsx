import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';

import { CairnForm } from '@/components/CairnForm';
import { getCairn, updateCairn } from '@/data/cairns';
import { colors } from '@/theme';
import { Cairn, CairnInput } from '@/types/cairn';

export default function EditCairn() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [cairn, setCairn] = useState<Cairn | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      getCairn(id).then(setCairn);
    }, [id]),
  );

  async function submit(input: CairnInput) {
    if (!id) return;
    await updateCairn(id, input);
    router.replace(`/cairn/${id}`);
  }

  if (!cairn) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.cream }}>
        <Text>Loading Cairn...</Text>
      </View>
    );
  }

  return <CairnForm initial={cairn} submitLabel="Save Cairn" onSubmit={submit} />;
}
