import { Stack } from "expo-router";
import { Text, View, Button } from "react-native";
import { useRouter } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';

export default function RootLayout() {
  const router = useRouter();

  return (
    <SafeAreaProvider>
      <Stack>
        <Stack.Screen name="add-hand" options={{ headerShown: false }} />
        <Stack.Screen name="index" options={{ headerTitle: "Saved Hands" }} />
        {/* other screens */}
      </Stack>
    </SafeAreaProvider>
  )
}
