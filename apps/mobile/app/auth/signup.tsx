import { SafeAreaView } from "react-native-safe-area-context";
import { SignupScreen } from "@/screens/auth/SignupScreen";

export default function SignupRoute(): JSX.Element {
  return (
    <SafeAreaView style={{ flex: 1 }} edges={["top"]}>
      <SignupScreen />
    </SafeAreaView>
  );
}
