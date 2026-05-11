import { MMKV } from "react-native-mmkv";

export const prefs = new MMKV({ id: "pulse.prefs" });

export const getRememberMe = (): boolean => prefs.getBoolean("rememberMe") ?? false;
export const setRememberMe = (v: boolean): void => prefs.set("rememberMe", v);
export const getFaceIdEnabled = (): boolean => prefs.getBoolean("faceIdEnabled") ?? false;
export const setFaceIdEnabled = (v: boolean): void => prefs.set("faceIdEnabled", v);
