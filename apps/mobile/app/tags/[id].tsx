import { SafeAreaView } from "react-native-safe-area-context";
import { TagFilterScreen } from "@/screens/tags/TagFilterScreen";

export default function TagFilterRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <TagFilterScreen />
    </SafeAreaView>
  );
}
