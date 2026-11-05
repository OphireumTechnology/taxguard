/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { createClient } from '@supabase/supabase-js';

const metaEnv = (import.meta as any)?.env || {};
const supabaseUrl = metaEnv.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = metaEnv.VITE_SUPABASE_ANON_KEY || 'placeholder-anon-key';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    metaEnv.VITE_SUPABASE_URL &&
    metaEnv.VITE_SUPABASE_ANON_KEY &&
    !metaEnv.VITE_SUPABASE_URL.includes('placeholder')
  );
};

export const isStaffIdentityDevelopmentConfigured = (): boolean => {
  return false;
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});
