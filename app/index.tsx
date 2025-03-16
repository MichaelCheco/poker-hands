import { Text, View, Button } from "react-native";
import { Link } from 'expo-router';
import { PaperProvider } from 'react-native-paper';

export default function Index() {
  return (
    <PaperProvider>
    <View
      style={{
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
      }}
    >
    </View>
    </PaperProvider>
  );
}
