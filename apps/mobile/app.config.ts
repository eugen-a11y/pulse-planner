import { ExpoConfig, ConfigContext } from "expo/config";

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: "Pulse",
  slug: "pulse-planner",
  owner: "deathrage94s-organization",
  scheme: "pulse",
  version: "0.1.17",
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/icon.png",
  splash: { image: "./assets/icon.png", resizeMode: "contain", backgroundColor: "#FFFFFF" },
  ios: {
    bundleIdentifier: "me.reinfeld.pulse",
    buildNumber: "18",
    supportsTablet: false,
    infoPlist: {
      UIBackgroundModes: ["fetch", "processing"],
      BGTaskSchedulerPermittedIdentifiers: ["pulse-bg-pull"],
      NSFaceIDUsageDescription: "Pulse nutzt Face ID zum schnellen Entsperren.",
      ITSAppUsesNonExemptEncryption: false
    },
    entitlements: {
      "com.apple.security.application-groups": ["group.me.reinfeld.pulse"]
    }
  },
  experiments: { typedRoutes: true },
  plugins: [
    "expo-router",
    "expo-secure-store",
    "expo-sqlite",
    ["expo-notifications", { color: "#2563EB" }],
    [
      "expo-splash-screen",
      {
        backgroundColor: "#FFFFFF",
        image: "./assets/icon.png",
        imageWidth: 120,
        resizeMode: "contain"
      }
    ],
    ["expo-build-properties", { ios: { useFrameworks: "static" } }],
    [
      "@bacons/apple-targets",
      {
        appleTeamId: "67YNFPW8Q3",
        targets: ["./targets/TodayWidget"]
      }
    ]
  ],
  extra: {
    eas: { projectId: "bad410c4-bd22-49c4-86c8-bc027c7b876d" },
    supabaseUrl: process.env.EXPO_PUBLIC_SUPABASE_URL,
    supabaseAnonKey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
  }
});
