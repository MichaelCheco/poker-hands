import { Stack } from "expo-router";
import { MD3LightTheme as DefaultTheme, PaperProvider } from 'react-native-paper';

import { SafeAreaProvider } from 'react-native-safe-area-context';

const theme = {
  ...DefaultTheme,
  button: {
    color: '#ffffff',
    backgroundColor: '#000000',
    transition: 'all 0.6s ease',
  },
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
        {/* options={{ headerTitle: "Add Hand", headerBackVisible: false }} */}
          <Stack.Screen name="add-hand" options={{
            headerBackButtonDisplayMode: "minimal",
            headerTitle: ''
          }}/>
          <Stack.Screen name="index" options={{ headerTitle: "Saved Hands"  }} />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  )
}
