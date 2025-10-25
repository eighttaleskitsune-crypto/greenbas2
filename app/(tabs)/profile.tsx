import { Text, TouchableOpacity, View } from "react-native";
import { supabase } from "../../services/supabase"; // Import Supabase client

export default function ProfileScreen() {
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      // The auth listener in _layout.tsx will detect the session change and redirect to /login
    } catch (error) {
      console.error('Logout error:', error.message);
      // Optionally, show an alert or toast here
    }
  };

  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-green-600 mb-4">Your Profile</Text>
      <TouchableOpacity
        className="bg-green-500 px-8 py-3 rounded-full"
        onPress={handleLogout}
      >
        <Text className="text-white font-semibold">Logout</Text>
      </TouchableOpacity>
    </View>
  );
}