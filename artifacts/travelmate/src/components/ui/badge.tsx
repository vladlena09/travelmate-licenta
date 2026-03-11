import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "outline" | "accent";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
  const baseStyles = "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors border";
  
  const variants = {
    default: "border-transparent bg-primary/20 text-primary-foreground backdrop-blur-sm",
    secondary: "border-transparent bg-muted text-muted-foreground",
    outline: "border-border text-foreground",
    accent: "border-transparent bg-accent/20 text-accent backdrop-blur-sm shadow-[0_0_10px_rgba(219,39,119,0.2)]",
  };

  return (
    <div className={cn(baseStyles, variants[variant], className)} {...props} />
  );
}

export { Badge };
