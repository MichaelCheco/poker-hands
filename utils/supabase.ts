import 'react-native-url-polyfill/auto'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || supabaseUrl.trim() === "") {
  const errorMessage = "Supabase URL is not set. Please check your environment variables (EXPO_PUBLIC_SUPABASE_URL).";
  console.error(errorMessage);
  throw new Error(errorMessage);
}

if (!supabaseAnonKey || supabaseAnonKey.trim() === "") {
  const errorMessage = "Supabase Anon Key is not set. Please check your environment variables (EXPO_PUBLIC_SUPABASE_ANON_KEY).";
  console.error(errorMessage);
  throw new Error(errorMessage);
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  }
);