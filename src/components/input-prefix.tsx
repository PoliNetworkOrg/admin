import * as React from "react"
import { cn } from "@/lib/utils"
import { Input } from "./ui/input"

export interface InputWithPrefixProps extends React.InputHTMLAttributes<HTMLInputElement> {
  prefix: string
  containerClassName?: string
}

const InputWithPrefix = React.forwardRef<HTMLInputElement, InputWithPrefixProps>(
  ({ className, type, prefix, containerClassName, ...props }, ref) => {
    return (
      <div className={cn("relative rounded-md overflow-hidden", containerClassName)}>
        <div className="text-accent-foreground/70 bg-accent/30 pointer-events-none absolute inset-y-0 left-0 flex items-center border-r border-input pr-2 pl-3">
          {prefix}
        </div>
        <Input type={type} className={cn("pl-11", className)} ref={ref} {...props} />
      </div>
    )
  }
)
InputWithPrefix.displayName = "InputWithPrefix"

export { InputWithPrefix }
