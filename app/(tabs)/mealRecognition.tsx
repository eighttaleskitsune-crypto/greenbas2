// app/(tabs)/MealRecognition.tsx
import { analyzeImageWithGemini, Meal } from "@/services/geminiService";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import { LinearGradient } from "expo-linear-gradient";
import React, { useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

export default function MealRecognition() {
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [mealResult, setMealResult] = useState<Meal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [permission, requestPermission] = useCameraPermissions();
  // Using CameraView type directly for better ref typing
  const cameraRef = useRef<CameraView>(null);

  const handleImageAnalysis = async (uri: string, mimeType?: string) => {
    setIsLoading(true);
    setMealResult(null);
    try {
      const result = await analyzeImageWithGemini(uri, mimeType);
      setMealResult(result);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "An unknown analysis error occurred.";
      Alert.alert("Analysis Failed", errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission Required", "Permission to access the gallery is required!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      quality: 0.8,
    });
    if (!result.canceled) {
      const asset = result.assets[0];
      setImageUri(asset.uri);
      handleImageAnalysis(asset.uri, asset.mimeType);
    }
  };

  const openCamera = async () => {
    const { granted } = await requestPermission();
    if (!granted) {
      Alert.alert("Permission Required", "Camera permission is required!");
      return;
    }
    setIsCameraActive(true);
  };

  const capturePhoto = async () => {
    if (cameraRef.current) {
      // takePictureAsync returns an object with a uri property
      const photo = await cameraRef.current.takePictureAsync({ quality: 0.8 });
      setIsCameraActive(false);
      setImageUri(photo.uri);
      handleImageAnalysis(photo.uri, 'image/jpeg'); // Camera photos are JPEG
    }
  };

  const resetState = () => {
    setImageUri(null);
    setMealResult(null);
  };

  // Camera View UI
  if (isCameraActive) {
    return (
      <View style={styles.cameraContainer}>
        <CameraView style={styles.camera} ref={cameraRef} facing="back" />
        <View style={styles.cameraControls}>
          <TouchableOpacity onPress={() => setIsCameraActive(false)} style={styles.cameraButton}>
            <Text style={styles.buttonText}>Cancel</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={capturePhoto} style={styles.captureButton} />
        </View>
      </View>
    );
  }

  // Main UI
  return (
    <LinearGradient colors={["#bbf7d0", "#86efac", "#4ade80"]} style={styles.container}>
      {isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#166534" />
          <Text style={styles.loadingText}>AI is analyzing your meal...</Text>
        </View>
      ) : imageUri && mealResult ? (
        <View style={styles.resultContainer}>
          <Image source={{ uri: imageUri }} style={styles.resultImage} />
          <Text style={styles.mealNameText}>{mealResult.meal_name}</Text>
          <Text style={styles.descriptionText}>{mealResult.description}</Text>
          <View style={styles.nutrientsContainer}>
            <Text style={styles.nutrientText}>🔥 Calories: {mealResult.calories}</Text>
            <Text style={styles.nutrientText}>💪 Protein: {mealResult.protein_g} g</Text>
            <Text style={styles.nutrientText}>🌾 Carbs: {mealResult.carbs_g} g</Text>
            <Text style={styles.nutrientText}>🧈 Fat: {mealResult.fat_g} g</Text>
          </View>
          <TouchableOpacity onPress={resetState} style={styles.actionButton}>
            <Text style={styles.buttonText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.initialContainer}>
          <Text style={styles.titleText}>Meal Recognition 📸</Text>
          <TouchableOpacity onPress={openCamera} style={styles.actionButton}>
            <Text style={styles.buttonText}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={pickImage} style={styles.actionButton}>
            <Text style={styles.buttonText}>Upload from Gallery</Text>
          </TouchableOpacity>
        </View>
      )}
    </LinearGradient>
  );
}

// Styles are largely the same as before
const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  cameraContainer: {
    flex: 1,
  },
  camera: {
    flex: 1,
  },
  cameraControls: {
    position: 'absolute',
    bottom: 40,
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  captureButton: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: 'white',
    borderWidth: 4,
    borderColor: '#16a34a',
  },
  cameraButton: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
  },
  initialContainer: {
    alignItems: 'center',
  },
  titleText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#14532d',
    marginBottom: 40,
    textAlign: 'center',
  },
  actionButton: {
    backgroundColor: '#16a34a',
    borderRadius: 30,
    paddingVertical: 14,
    paddingHorizontal: 32,
    marginBottom: 16,
    width: '80%',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  buttonText: {
    color: '#ffffff',
    fontSize: 18,
    fontWeight: '600',
  },
  loadingContainer: {
    alignItems: 'center',
  },
  loadingText: {
    color: '#14532d',
    marginTop: 16,
    fontSize: 18,
  },
  resultContainer: {
    alignItems: 'center',
    width: '100%',
  },
  resultImage: {
    width: 256,
    height: 256,
    borderRadius: 16,
    marginBottom: 24,
    borderWidth: 3,
    borderColor: 'white',
  },
  mealNameText: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#14532d',
    marginBottom: 8,
  },
  descriptionText: {
    color: '#14532d',
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    paddingHorizontal: 10,
  },
  nutrientsContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    marginBottom: 24,
  },
  nutrientText: {
    fontSize: 16,
    color: '#14532d',
    marginBottom: 8,
  },
});