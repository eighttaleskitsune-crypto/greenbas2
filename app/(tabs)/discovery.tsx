// app/(tabs)/discovery.tsx
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChefHat, Leaf, Search } from 'lucide-react-native';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Button,
  FlatList,
  Image,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { supabase } from '../../services/supabase';

// --- Types
type InstructionStep = { step: number; text: string };

type RecipeIngredientRow = {
  quantity: number | string | null;
  unit: string | null;
  ingredients: { name_en: string } | null;
};

type Recipe = {
  id: string;
  name_en: string;
  description_en?: string;
  image_url?: string | null;
  prep_time_minutes?: number | null;
  cook_time_minutes?: number | null;
  servings?: number | null;
  category_en?: string | null;
  difficulty?: string | null;
  tags?: string[] | null;
  instructions_en?: InstructionStep[];
  recipe_ingredients?: RecipeIngredientRow[];
};

const CATEGORIES = ['Vegetarian', 'Vegan', 'Gluten-Free', 'Low-Carb', 'Sustainable', 'Zero-Waste'];

export default function DiscoveryScreen() {
  const [featuredRecipes, setFeaturedRecipes] = useState<Recipe[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>('Sustainable');
  const [loading, setLoading] = useState(false);
  const [featuredLoading, setFeaturedLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 700, useNativeDriver: true }).start();
  }, []);

  useEffect(() => {
    // initial load
    loadFeatured();
    loadRecipes(selectedCategory ?? '');
  }, []);

  // Helper to add signed / public urls for images that look like storage paths
  const addSignedUrls = useCallback(async (rows: Recipe[]) => {
    return Promise.all(
      rows.map(async (r) => {
        const copy = { ...r } as Recipe;
        try {
          if (copy.image_url && copy.image_url.startsWith('recipes-images/')) {
            // getPublicUrl expects the path inside the bucket (no leading slash)
            const { data, error } = supabase.storage.from('recipes-images').getPublicUrl(copy.image_url);
            if (error) {
              // fallback: leave original path
              console.warn('getPublicUrl error', error.message);
            } else if (data?.publicUrl) {
              copy.image_url = data.publicUrl;
            }
          }
        } catch (e) {
          console.warn('addSignedUrls failed', e);
        }
        return copy;
      })
    );
  }, []);

  // Small timeout wrapper for network requests to avoid hanging UI
  const fetchWithTimeout = async <T,>(promise: Promise<T>, timeout = 8000): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out')), timeout)),
    ]) as Promise<T>;
  };

  const loadFeatured = async () => {
    setFeaturedLoading(true);
    setError(null);
    try {
      const query = supabase
        .from('recipes')
        .select(
          `id, name_en, description_en, image_url, prep_time_minutes, cook_time_minutes, servings, category_en, difficulty, tags, instructions_en, recipe_ingredients(quantity, unit, ingredients(name_en))`
        )
        .limit(6)
        .order('created_at', { ascending: false });

      const { data, error } = await fetchWithTimeout(query);
      if (error) throw error;
      const rows = (data || []) as Recipe[];
      setFeaturedRecipes(await addSignedUrls(rows));
    } catch (err: any) {
      console.error('loadFeatured error', err);
      setError(err?.message ?? 'Unable to load featured recipes');
    } finally {
      setFeaturedLoading(false);
    }
  };

  const loadRecipes = async (queryText: string, limit = 30) => {
    setLoading(true);
    setError(null);
    try {
      let builder = supabase
        .from('recipes')
        .select(
          `id, name_en, description_en, image_url, prep_time_minutes, cook_time_minutes, servings, category_en, difficulty, tags, instructions_en, recipe_ingredients(quantity, unit, ingredients(name_en))`
        )
        .limit(limit)
        .order('created_at', { ascending: false });

      if (queryText && queryText.trim().length > 0) {
        const q = queryText.trim();
        // search in name_en, description_en, and category_en using or + ilike
        const orExpr = `name_en.ilike.%${q}%,description_en.ilike.%${q}%,category_en.ilike.%${q}%`;
        builder = builder.or(orExpr);
      }

      const { data, error } = await fetchWithTimeout(builder);
      if (error) throw error;
      const rows = (data || []) as Recipe[];
      setRecipes(await addSignedUrls(rows));
    } catch (err: any) {
      console.error('loadRecipes error', err);
      setError(err?.message ?? 'Unable to load recipes');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleSearch = () => {
    // prefer explicit search query; if empty but category selected, search category
    const q = searchQuery && searchQuery.trim().length > 0 ? searchQuery.trim() : selectedCategory ?? '';
    loadRecipes(q);
  };

  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setSearchQuery('');
    loadRecipes(category);
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadFeatured();
    loadRecipes(selectedCategory ?? '');
  };

  const showRecipeDetails = (recipe: Recipe) => {
    setSelectedRecipe(recipe);
    setModalVisible(true);
    // small entrance animation
    fadeAnim.setValue(0);
    Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }).start();
  };

  const safeGetIngredients = (recipe: Recipe) => {
    return (recipe.recipe_ingredients || []).map((ri) => ({
      name: ri.ingredients?.name_en ?? 'Unknown',
      quantity: ri.quantity ?? '-',
      unit: ri.unit ?? '',
    }));
  };

  const addToShoppingPlanner = (ingredients: { name: string; quantity: any; unit: string }[]) => {
    try {
      const ingredientsJson = encodeURIComponent(JSON.stringify(ingredients));
      // navigate to your shopping planner route and pass encoded ingredients
      router.push(`/shoppingPlanner?ingredients=${ingredientsJson}`);
      setModalVisible(false);
    } catch (e) {
      console.warn('addToShoppingPlanner failed', e);
    }
  };

  // Renderers
  const renderFeaturedRecipe = ({ item }: { item: Recipe }) => (
    <Pressable style={styles.featuredCard} onPress={() => showRecipeDetails(item)}>
      <Image source={{ uri: item.image_url ?? undefined }} style={styles.featuredImage} resizeMode="cover" />
      <LinearGradient colors={["transparent", "rgba(0,100,0,0.75)"]} style={styles.featuredOverlay} />
      <View style={styles.featuredOverlayContent}>
        <Text style={styles.featuredBadge}>Featured 🌿</Text>
        <Text style={styles.featuredTitle} numberOfLines={2} ellipsizeMode="tail">{item.name_en}</Text>
      </View>
    </Pressable>
  );

  const renderCategory = ({ item }: { item: string }) => (
    <TouchableOpacity
      key={item}
      style={[styles.categoryButton, selectedCategory === item && styles.selectedCategoryButton]}
      onPress={() => handleCategorySelect(item)}
    >
      <Text style={[styles.categoryText, selectedCategory === item && styles.selectedCategoryText]}>{item}</Text>
    </TouchableOpacity>
  );

  const renderRecipe = ({ item }: { item: Recipe }) => (
    <Animated.View style={{ opacity: fadeAnim }}>
      <TouchableOpacity style={styles.recipeCard} onPress={() => showRecipeDetails(item)}>
        <Image source={{ uri: item.image_url ?? undefined }} style={styles.recipeImage} resizeMode="cover" />
        <View style={styles.recipeInfo}>
          <Text style={styles.recipeTitle}>{item.name_en}</Text>
          <Text style={styles.recipeMeta}>Prep: {item.prep_time_minutes ?? '-'} • Cook: {item.cook_time_minutes ?? '-'} • Serves: {item.servings ?? '-'}</Text>
          <Text style={styles.recipeDescription} numberOfLines={2}>{item.description_en ?? ''}</Text>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Text style={styles.recipeTags} numberOfLines={1}>{(item.tags || []).join(', ')}</Text>
            <Button title="Add to Planner" onPress={() => addToShoppingPlanner(safeGetIngredients(item))} color={Platform.OS === 'ios' ? undefined : '#4CAF50'} />
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <LinearGradient colors={["#dff6e6", "#f7fff7"]} style={styles.container}>
        <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
          <View style={styles.header}>
            <Leaf size={28} color="#228B22" />
            <Text style={styles.title}>GreenBas Discovery</Text>
            <ChefHat size={28} color="#228B22" />
          </View>

          <Text style={styles.sectionTitle}>Featured Eco Recipes</Text>

          {featuredLoading ? (
            <ActivityIndicator style={{ marginVertical: 20 }} size="large" />
          ) : (
            <FlatList
              data={featuredRecipes}
              renderItem={renderFeaturedRecipe}
              keyExtractor={(item) => item.id}
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.featuredList}
              ListEmptyComponent={<Text style={styles.emptyText}>No featured recipes yet.</Text>}
            />
          )}

          <Text style={styles.sectionTitle}>Categories</Text>
          <FlatList
            data={CATEGORIES}
            renderItem={renderCategory}
            keyExtractor={(item) => item}
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.categoryList}
          />

          <View style={styles.searchContainer}>
            <TextInput
              style={styles.searchInput}
              placeholder="Search recipes..."
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
              onSubmitEditing={handleSearch}
            />
            <TouchableOpacity style={styles.searchButton} onPress={handleSearch} accessibilityLabel="Search">
              <Search size={20} color="white" />
            </TouchableOpacity>
          </View>

          {error && <Text style={styles.errorText}>{error}</Text>}

          {loading ? (
            <ActivityIndicator size="large" color="#228B22" style={styles.loader} />
          ) : recipes.length === 0 ? (
            <Text style={styles.emptyText}>No recipes found. Try changing search or category.</Text>
          ) : (
            <FlatList
              data={recipes}
              renderItem={renderRecipe}
              keyExtractor={(item) => item.id}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
              contentContainerStyle={styles.recipeList}
            />
          )}

          <Modal animationType="fade" transparent={true} visible={modalVisible} onRequestClose={() => setModalVisible(false)}>
            <View style={[styles.modalContainer, { backgroundColor: 'rgba(0,0,0,0.45)' }]}>
              <Animated.View style={[styles.modalContent, { opacity: fadeAnim }]}> 
                <ScrollView>
                  {selectedRecipe ? (
                    <>
                      <Text style={styles.modalTitle}>{selectedRecipe.name_en}</Text>
                      <Image source={{ uri: selectedRecipe.image_url ?? undefined }} style={styles.modalImage} resizeMode="cover" />

                      <Text style={styles.sectionHeader}>Description</Text>
                      <Text style={styles.listItem}>{selectedRecipe.description_en ?? 'No description provided.'}</Text>

                      <Text style={styles.sectionHeader}>Ingredients</Text>
                      {safeGetIngredients(selectedRecipe).map((ing, idx) => (
                        <Text key={idx} style={styles.listItem}>• {ing.quantity} {ing.unit} {ing.name}</Text>
                      ))}

                      <Text style={styles.sectionHeader}>Instructions</Text>
                      {(selectedRecipe.instructions_en || []).map((s) => (
                        <Text key={s.step} style={styles.listItem}>{s.step}. {s.text}</Text>
                      ))}

                      <View style={{ marginTop: 18 }}>
                        <Button title="Add to Planner" onPress={() => addToShoppingPlanner(safeGetIngredients(selectedRecipe))} color="#4CAF50" />
                        <View style={{ height: 10 }} />
                        <Button title="Close" onPress={() => setModalVisible(false)} color="#999" />
                      </View>
                    </>
                  ) : (
                    <Text style={styles.emptyText}>No recipe selected.</Text>
                  )}
                </ScrollView>
              </Animated.View>
            </View>
          </Modal>
        </Animated.View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: Platform.OS === 'android' ? 24 : 0, paddingHorizontal: 16 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  title: { fontSize: 26, fontWeight: '700', color: '#228B22', marginHorizontal: 10 },
  sectionTitle: { fontSize: 20, fontWeight: '600', color: '#228B22', marginBottom: 10, marginTop: 6 },
  featuredList: { paddingVertical: 8 },
  featuredCard: { width: 220, height: 280, marginRight: 14, borderRadius: 18, overflow: 'hidden', elevation: 6 },
  featuredImage: { width: '100%', height: '100%' },
  featuredOverlay: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 120 },
  featuredOverlayContent: { position: 'absolute', left: 12, bottom: 12 },
  featuredBadge: { fontSize: 12, color: 'white', backgroundColor: '#2e7d32', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, alignSelf: 'flex-start', marginBottom: 8 },
  featuredTitle: { fontSize: 16, fontWeight: '700', color: 'white', width: 190 },
  categoryList: { paddingVertical: 8 },
  categoryButton: { backgroundColor: '#f0fff0', paddingHorizontal: 18, paddingVertical: 8, borderRadius: 20, marginRight: 10, elevation: 2 },
  selectedCategoryButton: { backgroundColor: '#2e7d32' },
  categoryText: { fontSize: 14, fontWeight: '600', color: '#333' },
  selectedCategoryText: { color: 'white' },
  searchContainer: { flexDirection: 'row', marginVertical: 12 },
  searchInput: { flex: 1, borderWidth: 1, borderColor: '#e0e0e0', padding: 12, borderRadius: 12, backgroundColor: 'white', elevation: 2 },
  searchButton: { backgroundColor: '#228B22', padding: 12, borderRadius: 12, marginLeft: 10, justifyContent: 'center' },
  recipeList: { paddingBottom: 20, paddingTop: 6 },
  recipeCard: { flexDirection: 'row', backgroundColor: 'white', borderRadius: 18, marginBottom: 14, elevation: 5, overflow: 'hidden' },
  recipeImage: { width: 140, height: 140 },
  recipeInfo: { flex: 1, padding: 12, justifyContent: 'space-between' },
  recipeTitle: { fontSize: 18, fontWeight: '700', color: '#333' },
  recipeMeta: { fontSize: 13, color: 'gray', marginVertical: 6 },
  recipeDescription: { fontSize: 14, color: '#444', marginBottom: 6 },
  recipeTags: { fontSize: 12, color: '#666', flex: 1 },
  emptyText: { textAlign: 'center', marginTop: 24, color: 'gray', fontSize: 15 },
  loader: { marginTop: 24 },
  modalContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  modalContent: { backgroundColor: 'white', padding: 18, borderRadius: 18, width: '95%', maxHeight: '86%', elevation: 12 },
  modalTitle: { fontSize: 22, fontWeight: '800', marginBottom: 12, color: '#228B22' },
  modalImage: { width: '100%', height: 260, borderRadius: 12, marginBottom: 10 },
  sectionHeader: { fontSize: 18, fontWeight: '700', marginTop: 12, marginBottom: 8, color: '#228B22' },
  listItem: { fontSize: 16, marginBottom: 8, lineHeight: 22 },
  errorText: { color: 'red', textAlign: 'center', marginBottom: 12, fontSize: 14 },
});
