import { SafeAreaView } from "react-native-safe-area-context";
import { DLQScreen } from "@/screens/settings/DLQScreen";

export default function DLQRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <DLQScreen />
    </SafeAreaView>
  );
}
