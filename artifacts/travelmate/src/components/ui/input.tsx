import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-14 w-full rounded-xl border-2 border-white/10 bg-black/20 px-4 py-2 text-base text-foreground placeholder:text-muted-foreground/50",
          "transition-all duration-300 backdrop-blur-sm",
          "focus:border-primary/50 focus:bg-black/40 focus:outline-none focus:ring-4 focus:ring-primary/10",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";

export { Input };
