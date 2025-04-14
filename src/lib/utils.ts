import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function getBaseUrl() {
  if (typeof window !== "undefined") return window.location.origin;
  if (process.env.PUBLIC_URL) return `https://${process.env.PUBLIC_URL}`;
  return `http://localhost:${process.env.PORT ?? 3000}`;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getInitials(name: string): string {
  const [first, second] = name.split(" ");
  if (first?.[0] && second?.[0])
    return first[0].toUpperCase() + second[0].toUpperCase();
  if (first?.[0] && !second?.[0] && first?.[1])
    return first[0].toUpperCase() + first[1].toLowerCase();

  return name.slice(0, 2); // fallback
}
