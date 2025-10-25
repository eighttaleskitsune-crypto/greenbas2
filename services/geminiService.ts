// services/geminiService.ts
import Constants from 'expo-constants';
import { File } from "expo-file-system";
import { Alert } from "react-native";

// Use the API key from your environment variables
const GEMINI_API_KEY = Constants.expoConfig?.extra?.GEMINI_API_KEY;

// Check for API Key presence at runtime
if (!GEMINI_API_KEY) {
    Alert.alert("Configuration Error", "GEMINI_API_KEY is missing. Check your .env file and app.config.js.");
    throw new Error("API Key is missing.");
}

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;

// Define the type for the meal data for strong type safety
export interface Meal {
  meal_name: string;
  description: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
}

const MealRecognitionPrompt = `You are a meal recognition AI. Identify the food in this image and return ONLY a JSON object with the following structure:
{
  "meal_name": "...",
  "description": "...",
  "calories": 0,
  "protein_g": 0,
  "carbs_g": 0,
  "fat_g": 0
}`;

/**
 * Analyzes an image URI to identify a meal and its nutritional information.
 * @param {string} uri - The local URI of the image to analyze.
 * @param {string} [mimeType="image/jpeg"] - The MIME type of the image.
 * @returns {Promise<Meal>} - A promise that resolves to the parsed meal data.
 */
export const analyzeImageWithGemini = async (uri: string, mimeType: string = "image/jpeg"): Promise<Meal> => {
  try {
    // 1. Convert local file to Base64 using new File API
    const file = new File(uri);
    const base64Image = await file.base64();

    // Validate MIME type (Gemini supports jpeg, png, webp, heic, heif)
    const supportedMimeTypes = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
    if (!supportedMimeTypes.includes(mimeType)) {
      throw new Error(`Unsupported image format: ${mimeType}. Convert to JPEG or PNG.`);
    }

    // 2. Make the Gemini API call
    const response = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: MealRecognitionPrompt },
              { inline_data: { mime_type: mimeType, data: base64Image } },
            ],
          },
        ],
      }),
    });
    
    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(`API Error: ${errorData.error?.message || response.statusText}`);
    }

    const data = await response.json();
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      throw new Error("No content returned from Gemini API.");
    }
    
    // 3. Robust JSON parsing (handling markdown fences from LLM)
    try {
        const cleanedText = text.replace(/```json|```/g, "").trim();
        const jsonStart = cleanedText.indexOf("{");
        const jsonEnd = cleanedText.lastIndexOf("}") + 1;
        const jsonString = cleanedText.substring(jsonStart, jsonEnd);
        return JSON.parse(jsonString);
    } catch (parseError) {
        console.error("Failed to parse JSON from API response:", text);
        throw new Error("Received an invalid format from the AI. Response was not a valid JSON object.");
    }
  } catch (error) {
    // Re-throw the error to be caught by the component
    throw error;
  }
};