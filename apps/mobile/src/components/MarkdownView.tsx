import { Text } from "react-native";
import Markdown from "react-native-markdown-display";

/**
 * Thin wrapper around `react-native-markdown-display` with Pulse-friendly
 * default styles. Used to render note bodies and project description
 * markdown in read-only mode.
 *
 * If the source is empty, renders the optional placeholder (or nothing).
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
      style={{
        body: { color: "#0F172A", fontSize: 14, lineHeight: 20 },
        heading1: { color: "#0F172A", fontSize: 18, fontWeight: "600", marginTop: 8, marginBottom: 4 },
        heading2: { color: "#0F172A", fontSize: 16, fontWeight: "600", marginTop: 6, marginBottom: 4 },
        heading3: { color: "#0F172A", fontSize: 15, fontWeight: "600", marginTop: 4, marginBottom: 2 },
        link: { color: "#2563EB" },
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
