import { View } from "react-native";
import Svg, { Path, Text as SvgText } from "react-native-svg";

/**
 * Priority indicator: rounded warning triangle with exclamation marks.
 * Color encodes severity (red high → orange mid → green low), exclamation
 * count reinforces it.
 */
const CFG: Record<number, { color: string; marks: string }> = {
  1: { color: "#DC2626", marks: "!!!" },
  2: { color: "#F97316", marks: "!!" },
  3: { color: "#16A34A", marks: "!" },
};

export function PriorityBadge({ priority }: { priority: 1 | 2 | 3 }): JSX.Element | null {
  const cfg = CFG[priority];
  if (!cfg) return null;
  return (
    <View style={{ width: 22, height: 20 }}>
      <Svg width={22} height={20} viewBox="0 0 22 20">
        <Path
          d="M11 2 L20 17 H2 Z"
          fill={cfg.color}
          stroke={cfg.color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <SvgText
          x={11}
          y={16}
          textAnchor="middle"
          fontSize={cfg.marks.length >= 3 ? 7 : 8}
          fontWeight="800"
          fill="#FFFFFF"
        >
          {cfg.marks}
        </SvgText>
      </Svg>
    </View>
  );
}
