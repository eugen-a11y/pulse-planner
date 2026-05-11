import { createContext, useContext } from "react";
import type { MobileDeps } from "./deps";

const DepsContext = createContext<MobileDeps | null>(null);
export const DepsProvider = DepsContext.Provider;

export function useDeps(): MobileDeps {
  const d = useContext(DepsContext);
  if (!d) throw new Error("useDeps must be used inside <DepsProvider>");
  return d;
}
