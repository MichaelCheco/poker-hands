import { supabase } from './supabase';


export async function signInAnonymously() {
    const { data, error } = await supabase.auth.signInAnonymously();
    console.log(data, error)
    return data;
}