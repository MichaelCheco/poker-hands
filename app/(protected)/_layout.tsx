import { AuthContext } from "@/utils/authContext";
import { Redirect, Stack } from "expo-router";
import { useContext } from "react";


export const unstable_settings = {
  initialRouteName: "index", // anchor
};

export default function ProtectedLayout() {
  const authState = useContext(AuthContext);

  if (!authState.isReady) {
    return null;
  }

  if (!authState.isLoggedIn()) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack>
      <Stack.Screen
        name="index"
        options={{
          headerTitle: "Saved Hands",
        }}
      />
      <Stack.Screen
        name="add-hand"
        options={{
          headerTitle: "Saved Hands",
        }}
      />
    </Stack>
  );
}