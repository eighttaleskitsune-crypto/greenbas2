import { Feather } from "@expo/vector-icons";
import { useEffect, useRef } from "react";
import { Animated, TextInput } from "react-native";

// Reusable animated form field component
export const FormField = ({ icon, isFocused, ...props }) => {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: isFocused ? 1 : 0,
      duration: 250,
      useNativeDriver: false, // color properties are not supported by native driver
    }).start();
  }, [isFocused]);

  const backgroundColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255, 255, 255, 0.25)", "rgba(255, 255, 255, 0.40)"],
  });

  const borderColor = anim.interpolate({
    inputRange: [0, 1],
    outputRange: ["rgba(255, 255, 255, 0.30)", "rgba(255, 255, 255, 0.70)"],
  });

  return (
    <Animated.View
      style={{
        flexDirection: "row",
        alignItems: "center",
        borderRadius: 16, // rounded-2xl
        width: "100%",
        padding: 12, // p-3
        borderWidth: 1,
        backgroundColor,
        borderColor,
      }}
    >
      <Feather name={icon} size={20} color="white" />
      <TextInput
        className="flex-1 ml-3 text-base text-white"
        placeholderTextColor="#e5e5e5"
        {...props}
      />
    </Animated.View>
  );
};