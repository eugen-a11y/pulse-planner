module.exports = {
  // No preset — our unit tests are pure Node (better-sqlite3 mock, no RN components).
  // jest-expo pulls in react-native/jest/setup.js (Flow-typed polyfills) and babel.config.js
  // uses react-native-reanimated/plugin which requires react-native-worklets. Both fail in Node.
  // We use ts-jest for direct TypeScript transpilation, bypassing Babel entirely.
  testEnvironment: "node",
  transform: {
    "^.+\\.tsx?$": ["ts-jest", {
      tsconfig: {
        // Relax strict settings enough for test files; app tsconfig extends expo/tsconfig.base
        // which we can't fully resolve in Node. Use a minimal inline config.
        module: "commonjs",
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        resolveJsonModule: true,
        strict: false,
        skipLibCheck: true,
        paths: {
          "@/*": ["./src/*"]
        }
      },
      diagnostics: false
    }]
  },
  // All node_modules are ignored for transform; @pulse/core is redirected to source via moduleNameMapper
  transformIgnorePatterns: ["node_modules"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
    "^expo-sqlite$": "<rootDir>/test/__mocks__/expo-sqlite",
    "^expo-secure-store$": "<rootDir>/test/__mocks__/expo-secure-store",
    "^expo-constants$": "<rootDir>/test/__mocks__/expo-constants",
    "^expo-notifications$": "<rootDir>/test/__mocks__/expo-notifications",
    "^react-native-mmkv$": "<rootDir>/test/__mocks__/react-native-mmkv",
    "^@supabase/supabase-js$": "<rootDir>/test/__mocks__/@supabase/supabase-js",
    // Point to the TypeScript source so ts-jest can transform it (dist is ESM-only)
    "^@pulse/core$": "<rootDir>/../../packages/core/src/index.ts",
    "^@pulse/core/(.*)$": "<rootDir>/../../packages/core/src/$1",
    // @pulse/core source files use .js extensions (ESM) — remap to .ts for ts-jest
    "^(\\.\\.?\\/.*)\\.js$": "$1"
  },
  testMatch: ["**/test/**/*.test.[jt]s?(x)"]
};
