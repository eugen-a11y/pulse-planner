import { SafeAreaView } from "react-native-safe-area-context";
import { SearchScreen } from "@/screens/search/SearchScreen";

export default function SearchRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <SearchScreen />
    </SafeAreaView>
  );
}
