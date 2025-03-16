import { Stack } from "expo-router";
import { Text, View, Button } from "react-native";
import { useRouter } from 'expo-router';

export default function RootLayout() {
  const router = useRouter();

  return <Stack 
  screenOptions={{
    headerStyle: {
      backgroundColor: '#f0f0f0', // Set background color
    },
    headerTintColor: '#333', // Set text color
    headerTitleStyle: {
      fontWeight: 'bold', // Set title font weight
    },
    headerRight: () => (
      <Button
        onPress={() => router.push('add-hand')}
        title="Info"
        color="#00cc00"
      />
    ),
  }}/>;
}
