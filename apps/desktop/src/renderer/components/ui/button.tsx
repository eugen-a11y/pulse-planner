import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "../../lib/cn.js";

type Variant = "primary" | "secondary" | "ghost" | "danger";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: "sm" | "md";
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-pulse text-white hover:bg-pulse-hover",
  secondary: "bg-white border border-[var(--border)] text-gray-900 hover:bg-gray-50",
  ghost: "text-gray-700 hover:bg-gray-100",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant = "primary", size = "md", ...rest },
  ref,
) {
  const sizeClass = size === "sm" ? "h-8 px-3 text-sm" : "h-10 px-4 text-sm";
  return (
    <button
      ref={ref}
      className={cn(
        "inline-flex items-center justify-center rounded-md font-medium transition-colors",
        "disabled:opacity-50 disabled:pointer-events-none focus:outline-none focus:ring-2 focus:ring-pulse/40",
        sizeClass,
        VARIANT[variant],
        className,
      )}
      {...rest}
    />
  );
});
