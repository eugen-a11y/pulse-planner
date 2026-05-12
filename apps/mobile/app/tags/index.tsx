import { SafeAreaView } from "react-native-safe-area-context";
import { TagsScreen } from "@/screens/tags/TagsScreen";

export default function TagsRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <TagsScreen />
    </SafeAreaView>
  );
}
