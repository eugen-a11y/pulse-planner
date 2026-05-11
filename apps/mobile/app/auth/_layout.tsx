import { Stack } from "expo-router";

/**
 * Stack layout for the unauthenticated /auth route group. Header is hidden
 * because both LoginScreen and SignupScreen render their own headings.
 */
export default function AuthLayout(): JSX.Element {
  return <Stack screenOptions={{ headerShown: false }} />;
}
