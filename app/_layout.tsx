import { Stack } from "expo-router";
import { MD3LightTheme as DefaultTheme, PaperProvider } from 'react-native-paper';

import { SafeAreaProvider } from 'react-native-safe-area-context';

const theme = {
  ...DefaultTheme,
  button: {
    // width: '90%',
    // height: '48px',
    color: '#ffffff',
    backgroundColor: '#000000',
    // borderRadius: '5px',
    // margin: '5px',
    // fontSize: '15px',
    // border: '2px solid #000000',
    transition: 'all 0.6s ease',
    
    // outline: 0,
  },
  //   a {
  //     text-decoration: none;
  //     color: #000000;
      
  //     font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif;
  //   }
  //   margin-top: 5px;
  //   &:hover {
  //     transition: all 0.6s ease;
  //     background-color: #000000;
  // }
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
          <Stack.Screen name="index" options={{ headerTitle: "Saved Hands"  }} />
        </Stack>
      </PaperProvider>
    </SafeAreaProvider>
  )
}
