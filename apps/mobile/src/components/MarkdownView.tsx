import { Linking, Text } from "react-native";
import Markdown from "react-native-markdown-display";

/**
 * Thin wrapper around `react-native-markdown-display` with Pulse-friendly
 * default styles. Used to render note bodies, project descriptions and
 * task descriptions in read-only mode.
 *
 * Behaviour:
 *   • Empty source renders the optional placeholder (or nothing).
 *   • Links are intercepted via the library's `onLinkPress` callback and
 *     opened with `react-native.Linking.openURL` — returning `false`
 *     prevents the library's default WebView handling.
 *   • Heading styles mirror the project's NativeWind palette via inline
 *     `style` overrides (the library doesn't accept className on every node).
 */
export interface MarkdownViewProps {
  source: string;
  placeholder?: string;
}

export function MarkdownView({ source, placeholder }: MarkdownViewProps): JSX.Element | null {
  if (!source.trim()) {
    if (placeholder) {
      return <Text className="text-sm italic text-gray-400">{placeholder}</Text>;
    }
    return null;
  }
  return (
    <Markdown
      onLinkPress={(url: string) => {
        // Best-effort open in system browser / app. Failures are swallowed —
        // the library logs anything it can't hand off to the OS.
        void Linking.openURL(url).catch(() => undefined);
        // Returning `false` tells the library NOT to attempt its own handling
        // (which would otherwise try to push a WebView route on iOS).
        return false;
      }}
      style={{
        body: { color: "#0F172A", fontSize: 14, lineHeight: 20 },
        heading1: { color: "#0F172A", fontSize: 18, fontWeight: "600", marginTop: 8, marginBottom: 4 },
        heading2: { color: "#0F172A", fontSize: 16, fontWeight: "600", marginTop: 6, marginBottom: 4 },
        heading3: { color: "#0F172A", fontSize: 15, fontWeight: "600", marginTop: 4, marginBottom: 2 },
        link: { color: "#2563EB", textDecorationLine: "underline" },
        code_inline: { backgroundColor: "#F1F5F9", color: "#0F172A", paddingHorizontal: 4, borderRadius: 4 },
        code_block: { backgroundColor: "#F1F5F9", padding: 8, borderRadius: 6 },
        fence: { backgroundColor: "#F1F5F9", padding: 8, borderRadius: 6 },
        bullet_list: { marginVertical: 4 },
        ordered_list: { marginVertical: 4 },
      }}
    >
      {source}
    </Markdown>
  );
}
