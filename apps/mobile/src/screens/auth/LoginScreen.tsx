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
 * Login screen. Mirrors the labels and "Angemeldet bleiben" behaviour of the
 * desktop AuthScreen (apps/desktop/src/renderer/auth/AuthScreen.tsx) but is
 * laid out for touch input. Auto-restore via the route guard in
 * app/_layout.tsx handles returning users — no Face-ID branch needed.
 */
export function LoginScreen(): JSX.Element {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
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
    setBusy(true);
    try {
      await useAuth.getState().signIn(email.trim(), pw, rememberMe);
      router.replace("/(tabs)/today");
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
            <Text className="text-sm text-ink-muted mt-1">Anmelden</Text>
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
              style={{ color: "#0F172A" }}
              placeholderTextColor="#64748B"
              className="border border-gray-300 rounded-md px-3 py-3 text-base"
            />
            <TextInput
              value={pw}
              onChangeText={setPw}
              placeholder="Passwort"
              secureTextEntry
              autoCapitalize="none"
              autoComplete="password"
              editable={!busy}
              style={{ color: "#0F172A" }}
              placeholderTextColor="#64748B"
              className="border border-gray-300 rounded-md px-3 py-3 text-base mt-3"
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
                {busy ? "..." : "Anmelden"}
              </Text>
            </Pressable>

            <View className="items-center mt-3">
              <Pressable onPress={() => router.push("/auth/forgot")} hitSlop={8}>
                <Text className="text-sm text-pulse underline">Passwort vergessen?</Text>
              </Pressable>
            </View>

            <View className="flex-row justify-center mt-6">
              <Text className="text-sm text-ink-muted">Neu hier? </Text>
              <Pressable onPress={() => router.push("/auth/signup")} hitSlop={8}>
                <Text className="text-sm text-pulse underline">Konto erstellen</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
