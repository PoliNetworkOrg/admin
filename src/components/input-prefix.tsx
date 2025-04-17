import * as React from "react";
import { cn } from "@/lib/utils";
import { Input } from "./ui/input";

export interface InputWithPrefixProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix: string;
}

const InputWithPrefix = React.forwardRef<
  HTMLInputElement,
  InputWithPrefixProps
>(({ className, type, prefix, ...props }, ref) => {
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 pr-2 text-accent-foreground/70 bg-accent/30 border-r">
        {prefix}
      </div>
      <Input type={type} className={cn("pl-11", className)} ref={ref} {...props} />
    </div>
  );
});
InputWithPrefix.displayName = "InputWithPrefix";

export { InputWithPrefix };
