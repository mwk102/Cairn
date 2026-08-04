import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: colors.paper },
            headerTintColor: colors.ink,
            contentStyle: { backgroundColor: colors.cream },
          }}
        >
          <Stack.Screen name="index" options={{ headerShown: false }} />
          <Stack.Screen name="welcome" options={{ headerShown: false }} />
          <Stack.Screen name="map" options={{ headerShown: false }} />
          <Stack.Screen name="cairn/build" options={{ title: 'Build Cairn' }} />
          <Stack.Screen name="cairn/[id]" options={{ title: 'Cairn' }} />
          <Stack.Screen name="cairn/[id]/edit" options={{ title: 'Edit Cairn' }} />
          <Stack.Screen name="cairn/[id]/share/index" options={{ title: 'Share Cairn' }} />
          <Stack.Screen name="cairn/[id]/share/success" options={{ title: 'Cairn Shared' }} />
          <Stack.Screen name="cairn/[id]/visit/new" options={{ title: 'Log Visit' }} />
          <Stack.Screen name="cairn/[id]/visit/[visitId]/edit" options={{ title: 'Edit Visit' }} />
          <Stack.Screen name="share/receive/index" options={{ title: 'Receive Cairn' }} />
          <Stack.Screen name="share/receive/success" options={{ title: 'Cairn Added' }} />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
