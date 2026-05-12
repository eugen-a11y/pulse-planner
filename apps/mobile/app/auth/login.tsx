import { SafeAreaView } from "react-native-safe-area-context";
import { LoginScreen } from "@/screens/auth/LoginScreen";

export default function LoginRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <LoginScreen />
    </SafeAreaView>
  );
}
