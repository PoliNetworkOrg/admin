import Image, { type ImageProps } from "next/image"
import logo from "@/assets/logo.svg"

export function Logo({ size, ...props }: { size?: number } & Omit<ImageProps, "src" | "alt" | "height" | "width">) {
  return <Image src={logo} alt="PoliNetwork Logo" height={size ?? 32} width={size ?? 32} {...props} />
}
