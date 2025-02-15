import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

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
