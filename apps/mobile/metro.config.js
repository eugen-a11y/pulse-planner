const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const config = getDefaultConfig(__dirname);
config.watchFolders = [path.resolve(__dirname, "../../packages/core")];
config.resolver.disableHierarchicalLookup = false;

module.exports = withNativeWind(config, { input: "./global.css" });
