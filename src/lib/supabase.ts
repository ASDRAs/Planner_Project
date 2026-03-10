import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-key';

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  console.warn("WARNING: Supabase environment variables are missing. Auth features will not work.");
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
