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
import { useDeps } from "@/wiring/depsContext";

/**
 * "Passwort vergessen" — sends a Supabase recovery email. The link in that
 * email redirects to a GitHub-Pages-hosted static page that lets the user
 * set a new password (apps/desktop and mobile then re-login normally).
 *
 * redirectTo URL must be whitelisted in Supabase dashboard → Auth → URL Config
 * → Additional Redirect URLs.
 */
const RESET_REDIRECT = "https://eugen-a11y.github.io/pulse-planner/reset-password.html";

export function ForgotPasswordScreen(): JSX.Element {
  const router = useRouter();
  const deps = useDeps();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(): Promise<void> {
    if (busy) return;
    setError(null);
    const trimmed = email.trim();
    if (!trimmed.includes("@")) {
      setError("Bitte gib eine gültige E-Mail-Adresse ein.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await deps.supabase.auth.resetPasswordForEmail(trimmed, {
        redirectTo: RESET_REDIRECT,
      });
      if (error) throw new Error(error.message);
      setSent(true);
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
            <Text className="text-2xl font-semibold text-pulse">Passwort vergessen</Text>
            <Text className="text-sm text-ink-muted mt-1 text-center">
              Wir senden dir einen Link, um dein Passwort neu zu setzen.
            </Text>
          </View>

          {sent ? (
            <View className="space-y-4">
              <View className="bg-green-50 border border-green-200 rounded-md p-4">
                <Text className="text-sm text-green-800">
                  E-Mail gesendet an <Text className="font-medium">{email.trim()}</Text>.
                </Text>
                <Text className="text-sm text-green-800 mt-2">
                  Öffne den Link in der Mail im Browser, vergib ein neues Passwort,
                  und melde dich danach hier neu an.
                </Text>
              </View>
              <Pressable
                onPress={() => router.replace("/auth/login")}
                className="rounded-md py-3 items-center bg-pulse"
              >
                <Text className="text-white text-base font-medium">Zurück zur Anmeldung</Text>
              </Pressable>
            </View>
          ) : (
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
                placeholderTextColor="#94A3B8"
                className="border border-gray-300 rounded-md px-3 py-3 text-base"
              />

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
                  {busy ? "..." : "Reset-Link senden"}
                </Text>
              </Pressable>

              <Pressable
                onPress={() => router.back()}
                className="py-3 items-center mt-2"
              >
                <Text className="text-sm text-ink-muted underline">Abbrechen</Text>
              </Pressable>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
