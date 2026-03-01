import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-11 w-full rounded-xl border border-foreground/20 bg-card px-3 py-3 text-base text-foreground shadow-[0_1px_3px_0_hsl(var(--foreground)/0.06)] ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-foreground/40 focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-[0_0_0_3px_hsl(var(--primary)/0.15)] disabled:cursor-not-allowed disabled:opacity-50 md:text-sm transition-all",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
