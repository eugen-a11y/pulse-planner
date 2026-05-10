import { create } from "zustand";
import { useEffect } from "react";

interface Toast {
  id: number;
  text: string;
  kind: "info" | "error" | "success";
}

interface ToastState {
  toasts: Toast[];
  push(text: string, kind?: Toast["kind"]): void;
  dismiss(id: number): void;
}

let nextId = 1;
export const useToasts = create<ToastState>((set) => ({
  toasts: [],
  push(text, kind = "info") {
    const id = nextId++;
    set((s) => ({ toasts: [...s.toasts, { id, text, kind }] }));
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), 4000);
  },
  dismiss(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

const KIND_CLASS: Record<Toast["kind"], string> = {
  info: "bg-gray-900 text-white",
  error: "bg-red-600 text-white",
  success: "bg-pulse text-white",
};

export function ToastStack() {
  const toasts = useToasts((s) => s.toasts);
  const dismiss = useToasts((s) => s.dismiss);
  useEffect(() => {}, []);
  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          className={`px-4 py-2 rounded-md shadow-md text-sm cursor-pointer ${KIND_CLASS[t.kind]}`}
        >{t.text}</div>
      ))}
    </div>
  );
}
