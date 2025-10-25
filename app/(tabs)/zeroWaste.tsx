import { Text, View } from "react-native";

export default function ZeroWasteScreen() {
  return (
    <View className="flex-1 items-center justify-center bg-white">
      <Text className="text-2xl font-bold text-green-600 mb-2">Zero Waste Mode</Text>
      <Text className="text-gray-500">
        (Track leftovers and reduce food waste)
      </Text>
    </View>
  );
}
