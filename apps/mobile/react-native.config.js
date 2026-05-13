// Force RN-CLI Android autolinking to look up the modern ExpoModulesPackage
// location (expo.modules.*) instead of falling back to the legacy expo.core.*
// path. pnpm + monorepo + SDK 52 sometimes produces stale generated
// PackageList.java imports on EAS, this nails it down explicitly.
module.exports = {
  dependencies: {
    expo: {
      platforms: {
        android: {
          packageImportPath: "import expo.modules.ExpoModulesPackage;",
          packageInstance: "new ExpoModulesPackage()",
        },
      },
    },
  },
};
