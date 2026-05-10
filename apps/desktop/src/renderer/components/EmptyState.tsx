import type { ReactNode } from "react";

export function EmptyState({ icon, title, hint }: { icon: ReactNode; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center text-center py-16">
      <div className="text-pulse mb-3">{icon}</div>
      <div className="text-lg font-medium text-gray-900">{title}</div>
      {hint && <div className="text-sm text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
