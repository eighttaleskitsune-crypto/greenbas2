// services/supabase.ts

import 'react-native-url-polyfill/auto'; // ✅ must be imported first
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

// ✅ Make sure these are defined in your .env file or app.config.js
// Example: 
// EXPO_PUBLIC_SUPABASE_URL=https://yourproject.supabase.co
// EXPO_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

// ✅ Safety check — helps during development
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.warn(
    '⚠️ Missing Supabase URL or Anon Key. Please check your .env or app.json (under "extra").'
  );
}

// ✅ Create Supabase client
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false, // Important for React Native (no browser redirects)
  },
});
