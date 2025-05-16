import { useAuth } from '@/utils/authContext';
import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, useTheme, ActivityIndicator, HelperText } from 'react-native-paper';

export default function LoginScreen() {
  const { logIn, signUp } = useAuth(); // Get functions from your AuthContext
  const theme = useTheme(); // Optional: for theming

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // State for toggling between Login and Sign Up modes
  const [isSignUpMode, setIsSignUpMode] = useState(false);

  const handleLogin = async () => {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await logIn(email, password);
      if (result?.error) {
        setError(result.error.message || "Failed to log in. Please check your credentials.");
      }
      // Navigation on success is handled by AuthProvider's onAuthStateChange or logIn function
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred during login.");
    }
    setIsLoading(false);
  };

  const handleSignUp = async () => {
    if (!email || !password) {
      setError("Email and password are required.");
      return;
    }
    setIsLoading(true);
    setError(null);
    try {
      const result = await signUp(email, password);
      if (result?.error) {
        setError(result.error.message || "Failed to sign up. Please try again.");
      } else {
        // Alert or message is handled by signUp function in AuthProvider
        // Potentially switch to login mode or show a success message
        setIsSignUpMode(false); // Switch back to login mode after successful signup prompt
        setEmail(''); // Clear fields
        setPassword('');
      }
    } catch (e: any) {
      setError(e.message || "An unexpected error occurred during sign up.");
    }
    setIsLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      style={[styles.container, { backgroundColor: theme.colors.background }]}
      keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
    >
      <ScrollView contentContainerStyle={styles.scrollContainer}>
        <Text variant="headlineMedium" style={styles.title}>
          {isSignUpMode ? 'Create Account' : 'Welcome Back!'}
        </Text>

        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          mode="outlined"
          style={styles.input}
          keyboardType="email-address"
          autoCapitalize="none"
          disabled={isLoading}
          activeOutlineColor='#000000'
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          mode="outlined"
          style={styles.input}
          secureTextEntry
          autoCapitalize="none"
          disabled={isLoading}
          activeOutlineColor='#000000'
        />

        {error && (
          <HelperText type="error" visible={!!error} style={styles.errorText}>
            {error}
          </HelperText>
        )}

        {isLoading ? (
          <ActivityIndicator animating={true} size="large" style={styles.loader} />
        ) : (
          <>
            <Button
              mode="contained"
              onPress={isSignUpMode ? handleSignUp : handleLogin}
              style={{ ...styles.button, ...theme.button }}
              labelStyle={styles.buttonLabel}
              disabled={isLoading}
            >
              {isSignUpMode ? 'Sign Up' : 'Log In'}
            </Button>

            <Button
              mode="text"
              onPress={() => {
                setIsSignUpMode(!isSignUpMode);
                setError(null); // Clear errors when switching modes
                // setEmail(''); // Optionally clear fields when switching
                // setPassword('');
              }}
              style={styles.toggleButton}
              disabled={isLoading}
            >
              {isSignUpMode ? 'Already have an account? Log In' : "Don't have an account? Sign Up"}
            </Button>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 30,
  },
  title: {
    textAlign: 'center',
    marginBottom: 24,
    fontWeight: 'bold',
  },
  input: {
    marginBottom: 16,
  },
  button: {
    marginTop: 16,
    paddingVertical: 8,
  },
  buttonLabel: {
    fontSize: 16,
  },
  toggleButton: {
    marginTop: 20,
  },
  loader: {
    marginTop: 24,
    marginBottom: 16,
  },
  errorText: {
    marginBottom: 10,
    fontSize: 14,
    textAlign: 'center',
  },
});
