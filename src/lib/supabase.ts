import { createClient } from '@supabase/supabase-js';

const RUNTIME_SUPABASE_URL_KEY = 'planner-runtime-supabase-url';
const RUNTIME_SUPABASE_ANON_KEY = 'planner-runtime-supabase-anon-key';

function getRuntimeConfig(): { url: string; anonKey: string } {
  if (typeof window === 'undefined') {
    return { url: '', anonKey: '' };
  }
  return {
    url: window.localStorage.getItem(RUNTIME_SUPABASE_URL_KEY) || '',
    anonKey: window.localStorage.getItem(RUNTIME_SUPABASE_ANON_KEY) || '',
  };
}

const envSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const envSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const runtimeConfig = getRuntimeConfig();

const supabaseUrl = envSupabaseUrl || runtimeConfig.url || 'https://placeholder.supabase.co';
const supabaseAnonKey = envSupabaseAnonKey || runtimeConfig.anonKey || 'placeholder-key';

export const isSupabaseConfigured =
  !!(envSupabaseUrl && envSupabaseAnonKey) || !!(runtimeConfig.url && runtimeConfig.anonKey);

if (!isSupabaseConfigured) {
  console.warn(
    'WARNING: Supabase environment variables/runtime config are missing. Auth features will not work.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // 저장소 차단 대비 방어 로직
    storageKey: 'planner-auth-v1'
  }
});

export function setRuntimeSupabaseConfig(url: string, anonKey: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(RUNTIME_SUPABASE_URL_KEY, url.trim());
  window.localStorage.setItem(RUNTIME_SUPABASE_ANON_KEY, anonKey.trim());
}

export function clearRuntimeSupabaseConfig(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(RUNTIME_SUPABASE_URL_KEY);
  window.localStorage.removeItem(RUNTIME_SUPABASE_ANON_KEY);
}

/**
 * Get current session once
 */
export async function getCurrentSession() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) return null;
  return session;
}

/**
 * Get current user from session
 */
export async function getCurrentUser() {
  const session = await getCurrentSession();
  return session?.user ?? null;
}

/**
 * Validate session and return user info
 */
export async function validateSession(): Promise<{ isValid: boolean; userId: string | null }> {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
      return { isValid: false, userId: null };
    }
    return { isValid: true, userId: session.user.id };
  } catch {
    return { isValid: false, userId: null };
  }
}
