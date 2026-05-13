import { MMKV } from "react-native-mmkv";

export const prefs = new MMKV({ id: "pulse.prefs" });

export const getRememberMe = (): boolean => prefs.getBoolean("rememberMe") ?? false;
export const setRememberMe = (v: boolean): void => prefs.set("rememberMe", v);
