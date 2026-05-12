import { SafeAreaView } from "react-native-safe-area-context";
import { TaskDetailScreen } from "@/screens/tasks/TaskDetailScreen";

export default function TaskRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <TaskDetailScreen />
    </SafeAreaView>
  );
}
