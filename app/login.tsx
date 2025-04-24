import { Button, Text } from "react-native-paper";
import { AuthContext } from "@/utils/authContext";
import { useContext } from "react";
import { View } from "react-native";

export default function LoginScreen() {
  const authContext = useContext(AuthContext);

  return (
    <View>
      <Text>
        Login Screen
      </Text>
      <Button style={{width: 130}} onPress={authContext.logIn} mode="contained" buttonColor="#000000" textColor='#FFFFFF'>Login</Button>
    </View>
  );
}