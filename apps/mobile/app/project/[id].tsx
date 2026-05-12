import { SafeAreaView } from "react-native-safe-area-context";
import { ProjectDetailScreen } from "@/screens/projects/ProjectDetailScreen";

export default function ProjectRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ProjectDetailScreen />
    </SafeAreaView>
  );
}
