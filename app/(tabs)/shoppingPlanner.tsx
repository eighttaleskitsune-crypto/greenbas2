import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../lib/supabase'; // ✅ adjust if your path differs

interface ShoppingItem {
  id: string;
  name: string;
  checked: boolean;
  user_id: string;
  created_at?: string;
}

export default function ShoppingPlanner() {
  const params = useLocalSearchParams();
  const router = useRouter();

  const [user, setUser] = useState<any>(null);
  const [items, setItems] = useState<ShoppingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [newItem, setNewItem] = useState('');
  const [syncing, setSyncing] = useState(false);

  // 🔹 Load user + items initially
  useEffect(() => {
    (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      setUser(user);
      await fetchItems(user.id);

      // Handle "ingredients" param from discovery
      const ingredientsParam = params.ingredients as string | undefined;
      if (ingredientsParam) {
        const ingredients = decodeURIComponent(ingredientsParam)
          .split(',')
          .map((i) => i.trim())
          .filter(Boolean);

        if (ingredients.length > 0) {
          await addIngredientsFromParams(ingredients, user.id);
          router.replace('/(tabs)/shoppingPlanner'); // cleanup URL
        }
      }
    })();
  }, []);

  // 🔹 Fetch items from Supabase
  async function fetchItems(userId: string) {
    setLoading(true);
    const { data, error } = await supabase
      .from('shopping_list_items')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error(error);
      Alert.alert('Error', 'Failed to load shopping list');
    } else {
      setItems(data || []);
    }
    setLoading(false);
  }

  // 🔹 Add ingredients passed from recipe discovery
  async function addIngredientsFromParams(ingredients: string[], userId: string) {
    const existingNames = items.map((i) => i.name.toLowerCase());
    const newOnes = ingredients.filter((i) => !existingNames.includes(i.toLowerCase()));
    if (!newOnes.length) return;

    const { error } = await supabase.from('shopping_list_items').insert(
      newOnes.map((name) => ({
        name,
        checked: false,
        user_id: userId,
        created_at: new Date().toISOString(),
      }))
    );

    if (error) {
      console.error(error);
      Alert.alert('Error', 'Could not add ingredients');
    } else {
      Alert.alert('Success', `${newOnes.length} ingredients added to planner`);
      await fetchItems(userId);
    }
  }

  // 🔹 Add manual item
  async function addItem() {
    if (!newItem.trim() || !user) return;

    const { error } = await supabase.from('shopping_list_items').insert({
      name: newItem.trim(),
      checked: false,
      user_id: user.id,
      created_at: new Date().toISOString(),
    });

    if (error) Alert.alert('Error', 'Could not add item');
    else {
      setNewItem('');
      await fetchItems(user.id);
    }
  }

  // 🔹 Toggle item checked/unchecked
  async function toggleItem(id: string, checked: boolean) {
    const { error } = await supabase
      .from('shopping_list_items')
      .update({ checked: !checked })
      .eq('id', id);

    if (error) Alert.alert('Error', 'Failed to update item');
    else await fetchItems(user.id);
  }

  // 🔹 Delete item
  async function deleteItem(id: string) {
    const { error } = await supabase.from('shopping_list_items').delete().eq('id', id);
    if (error) Alert.alert('Error', 'Failed to delete item');
    else await fetchItems(user.id);
  }

  // 🔹 Sync ingredients from all meal plans
  async function syncFromRecipes() {
    if (!user) return;
    setSyncing(true);

    try {
      const { data, error } = await supabase
        .from('meal_plan')
        .select('recipe:recipe_id ( ingredients ( name_en ) )')
        .eq('user_id', user.id);

      if (error) throw error;

      const allIngredients: string[] = [];
      data?.forEach((plan: any) => {
        plan.recipe?.ingredients?.forEach((ing: any) => {
          if (ing.name_en) allIngredients.push(ing.name_en);
        });
      });

      await addIngredientsFromParams(allIngredients, user.id);
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to sync from recipes');
    }

    setSyncing(false);
  }

  // 🔹 Loading state
  if (loading) {
    return (
      <SafeAreaView className="flex-1 items-center justify-center bg-white">
        <ActivityIndicator size="large" color="#10b981" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-white p-4">
      {/* Header */}
      <View className="flex-row items-center justify-between mb-4">
        <Text className="text-2xl font-bold text-gray-900">🛒 Shopping Planner</Text>
        <TouchableOpacity
          onPress={syncFromRecipes}
          disabled={syncing}
          className={`flex-row items-center px-3 py-2 rounded-xl ${
            syncing ? 'bg-gray-400' : 'bg-emerald-500'
          }`}>
          <Ionicons name="sync" size={18} color="white" />
          <Text className="text-white ml-1">
            {syncing ? 'Syncing...' : 'Sync from Recipes'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Add item input */}
      <View className="flex-row mb-4">
        <TextInput
          value={newItem}
          onChangeText={setNewItem}
          placeholder="Add a new item..."
          className="flex-1 border border-gray-300 rounded-xl px-3 py-2 mr-2 text-gray-800"
        />
        <TouchableOpacity
          onPress={addItem}
          className="bg-emerald-500 px-4 rounded-xl justify-center">
          <Ionicons name="add" size={24} color="white" />
        </TouchableOpacity>
      </View>

      {/* Items list */}
      {items.length === 0 ? (
        <View className="flex-1 items-center justify-center">
          <Text className="text-gray-400 text-base">No items yet — start adding some!</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => (
            <View className="flex-row items-center justify-between bg-gray-100 rounded-xl p-3 mb-2">
              <TouchableOpacity
                onPress={() => toggleItem(item.id, item.checked)}
                className="flex-row items-center flex-1">
                <Ionicons
                  name={item.checked ? 'checkbox' : 'square-outline'}
                  size={22}
                  color={item.checked ? '#10b981' : '#aaa'}
                />
                <Text
                  className={`ml-3 text-base ${
                    item.checked ? 'line-through text-gray-400' : 'text-gray-800'
                  }`}>
                  {item.name}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => deleteItem(item.id)}>
                <Ionicons name="trash" size={20} color="#f87171" />
              </TouchableOpacity>
            </View>
          )}
        />
      )}
    </SafeAreaView>
  );
}
