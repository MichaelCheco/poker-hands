import { supabase } from './supabase';

export async function signInAnonymously() {
    const { data } = await supabase.auth.signInAnonymously();
    return data;
}