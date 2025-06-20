import { AuthContext } from "@/utils/authContext";
import { Redirect, Stack } from "expo-router";
import { useContext } from "react";
import { Pressable, TouchableOpacity } from "react-native";
import { IconButton } from "react-native-paper";

export const unstable_settings = {
    initialRouteName: "index",
};

export default function ProtectedLayout() {
    const authState = useContext(AuthContext);

    if (!authState.isReady) {
        return null;
    }

    if (!authState.isLoggedIn) {
        return <Redirect href="/login" />;
    }

    return (
        <Stack>
            <Stack.Screen
                name="index"
                options={{
                    headerTitle: '',

                }}
            />
            <Stack.Screen
                name="add-hand"
                options={{
                    // headerBackButtonDisplayMode: "minimal",
                    headerTitle: ''
                }}
            />
        </Stack>
    );
}