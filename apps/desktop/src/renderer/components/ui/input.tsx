import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...rest }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-md border border-[var(--border)] bg-white px-3 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-pulse/40 focus:border-pulse",
          className,
        )}
        {...rest}
      />
    );
  },
);
