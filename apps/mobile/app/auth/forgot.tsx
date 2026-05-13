import { SafeAreaView } from "react-native-safe-area-context";
import { ForgotPasswordScreen } from "@/screens/auth/ForgotPasswordScreen";

export default function ForgotRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <ForgotPasswordScreen />
    </SafeAreaView>
  );
}
