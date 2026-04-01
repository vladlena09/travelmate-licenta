import * as React from "react";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "default" | "secondary" | "outline" | "ghost" | "glass";
  size?: "default" | "sm" | "lg" | "icon";
  asChild?: boolean;
}

function buttonVariants({
  variant = "default",
  size = "default",
  className = "",
}: {
  variant?: ButtonProps["variant"];
  size?: ButtonProps["size"];
  className?: string;
} = {}) {
  const baseStyles =
    "inline-flex items-center justify-center rounded-xl text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary disabled:pointer-events-none disabled:opacity-50 active:scale-95";

  const variants = {
    default:
      "bg-primary text-primary-foreground shadow-[0_0_15px_rgba(124,58,237,0.3)] hover:shadow-[0_0_25px_rgba(124,58,237,0.5)] hover:bg-primary/90",
    secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
    outline:
      "border-2 border-border bg-transparent hover:border-primary/50 hover:bg-primary/10 text-foreground",
    ghost: "hover:bg-accent/10 hover:text-accent text-muted-foreground",
    glass:
      "bg-white/5 backdrop-blur-md border border-white/10 text-foreground hover:bg-white/10 hover:shadow-lg",
  };

  const sizes = {
    default: "h-11 px-6 py-2",
    sm: "h-9 px-4 rounded-lg",
    lg: "h-14 px-8 text-base rounded-2xl",
    icon: "h-11 w-11",
  };

  return cn(baseStyles, variants[variant ?? "default"], sizes[size ?? "default"], className);
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", ...props }, ref) => {
    return (
      <button
        className={buttonVariants({ variant, size, className })}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = "Button";

export { Button, buttonVariants };