import { Stack } from "expo-router";
import { MD3LightTheme as DefaultTheme, PaperProvider } from 'react-native-paper';

import { SafeAreaProvider } from 'react-native-safe-area-context';

const theme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    myOwnColor: '#FFF',
    primary: '#7D7D7D',
    primaryContainer: '#0059EC',
    fabButton: '#48AEFF'
  },
};
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <PaperProvider theme={theme}>
        <Stack>
          <Stack.Screen name="add-hand" options={{ headerShown: false }} />
          <Stack.Screen name="index" options={{ headerTitle: "Saved Hands" }} />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  )
}
