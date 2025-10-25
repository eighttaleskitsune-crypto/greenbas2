import { Stack, usePathname, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { supabase } from '../services/supabase';

function LoadingIndicator() {
  return (
    <View style={styles.loadingContainer}>
      <ActivityIndicator size="large" color="#007bff" />
    </View>
  );
}

export default function RootLayout() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let mounted = true;

    // ✅ 1️⃣ Get current session from local storage
    const initSession = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      // ✅ 2️⃣ Double-check if session is still valid on the server
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!mounted) return;

      if (error || !user) {
        setSession(null);
      } else {
        setSession(session);
      }
      setLoading(false);
    };

    initSession();

    // ✅ 3️⃣ Listen for future auth changes
    const { data: authListener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (mounted) {
          setSession(session);
          setLoading(false);
        }
      }
    );

    return () => {
      mounted = false;
      authListener?.subscription?.unsubscribe?.();
    };
  }, []);

  useEffect(() => {
    if (loading) return;

    if (session) {
      // ✅ If logged in but currently on login screen → redirect to tabs
      if (pathname === '/login') {
        router.replace('/(tabs)');
      }
    } else {
      // ✅ If not logged in → redirect to login
      if (pathname !== '/login') {
        router.replace('/login');
      }
    }
  }, [session, loading, pathname, router]);

  if (loading) {
    return <LoadingIndicator />;
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
