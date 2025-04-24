import AsyncStorage from "@react-native-async-storage/async-storage";
import { SplashScreen, useRouter } from "expo-router";
import { createContext, PropsWithChildren, useEffect, useState } from "react";
import { signInAnonymously } from "@/utils/auth";

SplashScreen.preventAutoHideAsync();

type AuthState = {
  isLoggedIn: () => boolean;
  isReady: boolean;
  logIn: () => void;
  logOut: () => void;
  userId: string;
};

const authStorageKey = "auth-key";

export const AuthContext = createContext<AuthState>({
  isLoggedIn: () => { return false},
  isReady: false,
  logIn: () => Promise<void>,
  logOut: () => {},
  userId: '',
});

export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [isReady, setIsReady] = useState(false);
  const [userId, setUserId] = useState('');
  const router = useRouter();

  const storeAuthState = async (id: string) => {
    try {
      await AsyncStorage.setItem(authStorageKey, id);
    } catch (error) {
      console.log("Error saving", error);
    }
  };

  const isLoggedIn = () => userId !== '';

  const logIn = async () => {
    console.log('attempting login ...')
    const result = await signInAnonymously()
    const id = result.user?.id ?? '';
    console.log('id: ', id)
    storeAuthState(id);
    setUserId(id);
    router.replace("/");
  };

  const logOut = () => {
    setUserId('');
    storeAuthState('');
    router.replace("/login");
  };

  useEffect(() => {
    const getAuthFromStorage = async () => {
      // simulate a delay, e.g. for an API request
      await new Promise((res) => setTimeout(() => res(null), 2000));
      try {
        const value = await AsyncStorage.getItem(authStorageKey);
        console.log(`Value retrieved from AsyncStorage: ${value}`)
        setUserId(value ?? '');
      } catch (error) {
        console.log("Error fetching from storage", error);
      }
      setIsReady(true);
    };
    getAuthFromStorage();
  }, []);

  useEffect(() => {
    if (isReady) {
      SplashScreen.hideAsync();
    }
  }, [isReady]);

  return (
    <AuthContext.Provider value={{
        isReady,
        isLoggedIn,
        logIn,
        logOut,
        userId,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}