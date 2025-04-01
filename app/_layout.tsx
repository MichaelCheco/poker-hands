import { Stack } from "expo-router";
import { MD3LightTheme as DefaultTheme,PaperProvider } from 'react-native-paper';

import { SafeAreaProvider } from 'react-native-safe-area-context';
const theme = {
  ...DefaultTheme,
  // Specify custom property
  myOwnProperty: true,
  // Specify custom property in nested object
  colors: {
    ...DefaultTheme.colors,
    myOwnColor: '#FFF',
    primary: '#48AEFF',
    // background: '#0059EC',
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
        {/* other screens */}
      </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  )
}
