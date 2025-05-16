import AsyncStorage from "@react-native-async-storage/async-storage";
import { SplashScreen, useRouter } from "expo-router";
import { createContext, PropsWithChildren, useEffect, useState, useContext } from "react";
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/utils/supabase'; // Adjust path to your Supabase client

SplashScreen.preventAutoHideAsync();

// Define the shape of the authentication state and actions
type AuthContextType = {
  isLoggedIn: boolean;
  isReady: boolean;
  user: User | null; // Store the full Supabase user object
  session: Session | null; // Store the Supabase session
  logIn: (email?: string, password?: string) => Promise<{ error: Error | null } | void>; // Updated signature
  signUp: (email?: string, password?: string) => Promise<{ error: Error | null } | void>; // New function
  logOut: () => Promise<void>;
  // userId: string; // Can be derived from user?.id
};

// Key for storing session information if needed, though Supabase handles its own.
// We might not need this if relying solely on onAuthStateChange and getSession.
const authStorageKey = "supabase-auth-session"; // Changed key name

// Create the authentication context
export const AuthContext = createContext<AuthContextType>({
  isLoggedIn: false,
  isReady: false,
  user: null,
  session: null,
  logIn: async () => ({ error: null }),
  signUp: async () => ({ error: null }),
  logOut: async () => { },
  // userId: '',
});

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// AuthProvider component
export const AuthProvider = ({ children }: PropsWithChildren) => {
  const [isReady, setIsReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const router = useRouter();

  useEffect(() => {
    // Attempt to get the current session on app start
    supabase.auth.getSession().then(({ data: { session: currentSession } }) => {
      setSession(currentSession);
      setUser(currentSession?.user ?? null);
      setIsReady(true); // Ready after attempting to get session
      SplashScreen.hideAsync(); // Hide splash screen once session status is known
    }).catch(error => {
      console.error("Error getting initial session:", error);
      setIsReady(true); // Still ready, even if there was an error
      SplashScreen.hideAsync();
    });

    // Listen for authentication state changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        console.log(`Supabase auth event: ${_event}`, newSession);
        setSession(newSession);
        setUser(newSession?.user ?? null);

        // Persist session info if needed (Supabase client does this, but for quick access)
        if (newSession) {
          try {
            await AsyncStorage.setItem(authStorageKey, JSON.stringify(newSession));
          } catch (e) {
            console.error("Failed to save session to AsyncStorage", e);
          }
        } else {
          try {
            await AsyncStorage.removeItem(authStorageKey);
          } catch (e) {
            console.error("Failed to remove session from AsyncStorage", e);
          }
        }

        // Handle navigation based on auth state
        // This logic might need adjustment based on your app's flow
        if (_event === 'SIGNED_IN' && newSession) {
          // router.replace('/'); // Navigate to home after sign in
        } else if (_event === 'SIGNED_OUT') {
          // router.replace('/login'); // Navigate to login after sign out
        }
      }
    );

    // Cleanup listener on component unmount
    return () => {
      if (authListener?.subscription) {
        authListener.subscription.unsubscribe();
      }
    };
  }, []); // Empty dependency array ensures this runs once on mount

  // Function to sign up a new user
  const signUp = async (email?: string, password?: string) => {
    if (!email || !password) {
      console.error("Email and password are required for sign up.");
      return { error: new Error("Email and password are required.") };
    }
    setIsReady(false); // Indicate loading state
    const { data, error } = await supabase.auth.signUp({
      email: email,
      password: password,
    });
    setIsReady(true);

    if (error) {
      console.error("Supabase signUp error:", error.message);
      return { error };
    }
    if (data.user) {
      setUser(data.user); // Set user immediately, session will be handled by onAuthStateChange
      setSession(data.session);
      console.log("Sign up successful, user:", data.user);
      router.replace("/");
      // Supabase sends a confirmation email by default.
      // You might want to navigate to a "check your email" screen or directly log them in
      // if email confirmation is disabled or handled differently.
      // For now, onAuthStateChange will handle the SIGNED_IN event if auto-confirmed.
      // If email confirmation is required, user won't be fully "SIGNED_IN" until confirmed.
      // alert("Sign up successful! Please check your email to confirm your account if required.");
    }
    return { error: null };
  };

  // Function to log in an existing user
  const logIn = async (email?: string, password?: string) => {
    if (!email || !password) {
      console.error("Email and password are required for login.");
      return { error: new Error("Email and password are required.") };
    }
    setIsReady(false); // Indicate loading state
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });
    setIsReady(true);

    if (error) {
      console.error("Supabase signIn error:", error.message);
      return { error };
    }
    if (data.user && data.session) {
      setUser(data.user);
      setSession(data.session);
      console.log("Login successful, user:", data.user);
      router.replace("/"); // Navigate to home screen after successful login
    } else if (data.user && !data.session) {
      // This case might happen if MFA is enabled or other factors
      console.log("User data received but no session. MFA or other step might be required.");
      // Handle accordingly, e.g. navigate to MFA screen
    }
    return { error: null };
  };

  // Function to log out the current user
  const logOut = async () => {
    setIsReady(false);
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Supabase signOut error:", error.message);
    } else {
      setUser(null);
      setSession(null);
      try {
        await AsyncStorage.removeItem(authStorageKey);
      } catch (e) {
        console.error("Failed to remove session from AsyncStorage on logout", e);
      }
      console.log("Logout successful");
      router.replace("/login"); // Navigate to login screen after logout
    }
    setIsReady(true);
  };

  // Determine if the user is logged in based on the presence of a user object
  const isLoggedIn = !!user;

  // Hide splash screen once ready (moved to initial getSession effect)
  // useEffect(() => {
  //   if (isReady) {
  //     SplashScreen.hideAsync();
  //   }
  // }, [isReady]);

  return (
    <AuthContext.Provider
      value={{
        isReady,
        isLoggedIn,
        user,
        session,
        logIn,
        signUp,
        logOut,
        // userId: user?.id ?? '', // Derive userId from user object
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
