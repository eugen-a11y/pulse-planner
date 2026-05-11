import { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { useAuth } from "@/stores";
import {
  getRememberMe,
  setRememberMe as savePersistedRememberMe,
} from "@/lib/prefs";

/**
 * Signup screen. Mirrors LoginScreen's layout; adds a confirm-password field
 * and minimal client-side validation (length >= 8, match). Auth errors land
 * inline below the form.
 */
export function SignupScreen(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [rememberMe, setRememberMe] = useState<boolean>(getRememberMe());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleRemember(): void {
    const next = !rememberMe;
    setRememberMe(next);
    savePersistedRememberMe(next);
  }

  async function onSubmit(): Promise<void> {
    if (busy) return;
    setError(null);
    if (pw.length < 8) {
      setError("Passwort muss mindestens 8 Zeichen lang sein.");
      return;
    }
    if (pw !== confirm) {
      setError("Passwörter stimmen nicht überein.");
      return;
    }
    setBusy(true);
    try {
      await useAuth.getState().signUp(email.trim(), pw, rememberMe);
      // Route guard in app/_layout.tsx will redirect to /(tabs)/today.
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      className="flex-1 bg-white"
    >
      <ScrollView
        contentContainerStyle={{ flexGrow: 1, justifyContent: "center" }}
        keyboardShouldPersistTaps="handled"
      >
        <View className="px-6 py-10">
          <View className="items-center mb-8">
            <Image
              source={require("../../../assets/icon.png")}
              style={{ width: 64, height: 64, marginBottom: 12 }}
            />
            <Text className="text-2xl font-semibold text-pulse">Pulse Project Planner</Text>
            <Text className="text-sm text-ink-muted mt-1">Konto erstellen</Text>
          </View>

          <View className="space-y-3">
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="email@beispiel.de"
              keyboardType="email-address"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect={false}
              editable={!busy}
              className="border border-gray-300 rounded-md px-3 py-3 text-base text-ink"
            />
            <TextInput
              value={pw}
              onChangeText={setPw}
              placeholder="Passwort (mind. 8 Zeichen)"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!busy}
              className="border border-gray-300 rounded-md px-3 py-3 text-base text-ink mt-3"
            />
            <TextInput
              value={confirm}
              onChangeText={setConfirm}
              placeholder="Passwort bestätigen"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password-new"
              editable={!busy}
              className="border border-gray-300 rounded-md px-3 py-3 text-base text-ink mt-3"
            />

            <Pressable
              onPress={toggleRemember}
              className="flex-row items-center mt-3"
              hitSlop={8}
            >
              <View
                className={`w-5 h-5 rounded border mr-2 items-center justify-center ${
                  rememberMe ? "bg-pulse border-pulse" : "border-gray-400 bg-white"
                }`}
              >
                {rememberMe ? <Text className="text-white text-xs">✓</Text> : null}
              </View>
              <Text className="text-sm text-ink-muted">Angemeldet bleiben</Text>
            </Pressable>

            {error ? (
              <Text className="text-sm text-red-600 mt-2">{error}</Text>
            ) : null}

            <Pressable
              onPress={onSubmit}
              disabled={busy}
              className={`rounded-md py-3 items-center mt-4 ${
                busy ? "bg-pulse/60" : "bg-pulse"
              }`}
            >
              <Text className="text-white text-base font-medium">
                {busy ? "..." : "Konto erstellen"}
              </Text>
            </Pressable>

            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-ink-muted">Schon dabei? </Text>
              <Pressable
                onPress={() => {
                  if (router.canGoBack()) router.back();
                  else router.push("/auth/login");
                }}
                hitSlop={8}
              >
                <Text className="text-sm text-pulse underline">Anmelden</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
