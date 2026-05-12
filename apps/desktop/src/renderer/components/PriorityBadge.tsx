const CFG: Record<number, { color: string; marks: string }> = {
  1: { color: "#DC2626", marks: "!!!" },
  2: { color: "#F97316", marks: "!!" },
  3: { color: "#16A34A", marks: "!" },
};

export function PriorityBadge({ priority }: { priority: 1 | 2 | 3 }) {
  const cfg = CFG[priority];
  if (!cfg) return null;
  const fontSize = cfg.marks.length >= 3 ? 7 : 8;
  return (
    <span style={{ display: "inline-block", width: 18, height: 16, verticalAlign: "middle" }}>
      <svg width={18} height={16} viewBox="0 0 22 20">
        <path
          d="M11 2 L20 17 H2 Z"
          fill={cfg.color}
          stroke={cfg.color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <text
          x={11}
          y={16}
          textAnchor="middle"
          fontSize={fontSize}
          fontWeight={800}
          fill="#FFFFFF"
        >
          {cfg.marks}
        </text>
      </svg>
    </span>
  );
}
