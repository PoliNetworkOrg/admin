import * as React from "react";

import { cn } from "@/lib/utils";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, autoComplete, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        autoComplete={autoComplete}
        {...(autoComplete === "off" && {
          "data-1p-ignore": true,
          "data-lpignore": "true",
          "data-protonpass-ignore": "true",
        })}
        {...props}
        data-lpignore="true"
        data-protonpass-ignore="true"
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
