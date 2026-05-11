const { hairlineWidth } = require("nativewind/theme");

module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        pulse: { DEFAULT: "#2563EB", 50: "#EFF6FF", 600: "#2563EB", 700: "#1D4ED8" },
        ink: { DEFAULT: "#0F172A", muted: "#475569" }
      },
      borderWidth: { hairline: hairlineWidth() }
    }
  }
};
