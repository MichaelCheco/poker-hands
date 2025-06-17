import { useAuth } from '@/utils/authContext';
import React, { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView, Alert } from 'react-native';
import { TextInput, Button, Text, useTheme, ActivityIndicator, HelperText } from 'react-native-paper';

// Basic email validation regex
const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function LoginScreen() {
  const { logIn, signUp } = useAuth(); // Get functions from your AuthContext
  const theme = useTheme(); // Optional: for theming

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState(''); // New state for confirm password
  const [isLoading, setIsLoading] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null); // Specific error for email
  const [passwordError, setPasswordError] = useState<string | null>(null); // Specific error for password
  const [generalError, setGeneralError] = useState<string | null>(null); // General auth error

  // State for toggling between Login and Sign Up modes
  const [isSignUpMode, setIsSignUpMode] = useState(true);

  // --- Validation Logic ---
  const validateInputs = (mode: 'login' | 'signup') => {
    let isValid = true;
    setEmailError(null);
    setPasswordError(null);
    setGeneralError(null);

    if (!email.trim()) {
      setEmailError("Email is required.");
      isValid = false;
    } else if (!emailRegex.test(email)) {
      setEmailError("Please enter a valid email address.");
      isValid = false;
    }

    if (!password.trim()) {
      setPasswordError("Password is required.");
      isValid = false;
    } else if (password.length < 6) { // Common minimum password length
      setPasswordError("Password must be at least 6 characters long.");
      isValid = false;
    }

    if (mode === 'signup') {
      if (!confirmPassword.trim()) {
        setPasswordError("Please confirm your password."); // This will overwrite password error if primary
        isValid = false;
      } else if (password !== confirmPassword) {
        setPasswordError("Passwords do not match.");
        isValid = false;
      }
    }

    return isValid;
  };

  // --- Login Handler ---
  const handleLogin = async () => {
    if (!validateInputs('login')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await logIn(email, password);
      if (result?.error) {
        setGeneralError(result.error.message || "Failed to log in. Please check your credentials.");
      }
    } catch (e: any) {
      setGeneralError(e.message || "An unexpected error occurred during login.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- Sign Up Handler ---
  const handleSignUp = async () => {
    if (!validateInputs('signup')) {
      return;
    }

    setIsLoading(true);
    try {
      const result = await signUp(email, password);
      if (result?.error) {
        setGeneralError(result.error.message || "Failed to sign up. Please try again.");
      } else {
        // Sign up successful, clear fields and switch to login mode for next step
        setEmail('');
        setPassword('');
        setConfirmPassword('');
        setIsSignUpMode(false);
        // Alert handled by AuthProvider, often "Check your email for confirmation"
      }
    } catch (e: any) {
      setGeneralError(e.message || "An unexpected error occurred during sign up.");
    } finally {
      setIsLoading(false);
    }
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
          error={!!emailError} // Show error state
        />
        {emailError && <HelperText type="error" visible={!!emailError}>{emailError}</HelperText>}


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
          error={!!passwordError} // Show error state
        />
        {passwordError && <HelperText type="error" visible={!!passwordError}>{passwordError}</HelperText>}

        {isSignUpMode && ( // Only show confirm password in Sign Up mode
          <TextInput
            label="Confirm Password"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            mode="outlined"
            style={styles.input}
            secureTextEntry
            autoCapitalize="none"
            disabled={isLoading}
            activeOutlineColor='#000000'
            error={!!passwordError} // Reuse password error for visual consistency
          />
        )}

        {generalError && ( // General errors are displayed below all inputs
          <HelperText type="error" visible={!!generalError} style={styles.errorText}>
            {generalError}
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
                setEmailError(null);     // Clear specific errors
                setPasswordError(null);
                setGeneralError(null);   // Clear general error
                // Optionally clear fields when switching modes
                // setEmail('');
                // setPassword('');
                // setConfirmPassword('');
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
    marginBottom: 0, // Removed default margin to give HelperText more control
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
    // This style is now mainly for generalError, HelperText handles specific input errors
    marginBottom: 10,
    fontSize: 14,
    textAlign: 'center',
  },
});