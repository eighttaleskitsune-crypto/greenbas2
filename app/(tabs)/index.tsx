import { Redirect } from "expo-router";

export default function Index() {
  // redirect to your main tab (Discovery)
  return <Redirect href="/(tabs)/discovery" />;
}
