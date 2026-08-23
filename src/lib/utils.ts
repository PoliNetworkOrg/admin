import { type ClassValue, clsx } from "clsx"
import type { CSSProperties } from "react"
import { twMerge } from "tailwind-merge"

export type CSSVariableProperties = CSSProperties & {
  [name: `--${string}`]: string | number | undefined
}

export function cssVariables(properties: CSSVariableProperties): CSSProperties {
  return properties
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
