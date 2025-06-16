import * as React from 'react'
import { Stack } from "expo-router";
import { MD3LightTheme as DefaultTheme, PaperProvider } from 'react-native-paper';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from "@/utils/authContext";
import { GestureHandlerRootView } from 'react-native-gesture-handler'; // Import GestureHandlerRootView

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
    fabButton: '#48AEFF',
    secondaryContainer: '#000000'
  },
};

export default function RootLayout() {
  return (
    <GestureHandlerRootView>
    <SafeAreaProvider>
      <PaperProvider theme={theme} >
        <AuthProvider>
        <Stack>
          <Stack.Screen name="(protected)" options={{
            headerShown: false,
            animation: "none",
          }}/>
          <Stack.Screen name="login" options={{ animation: "none", headerTitle: '' }} />
        </Stack>
        </AuthProvider>
      </PaperProvider>
    </SafeAreaProvider>
    </GestureHandlerRootView>
  )
}