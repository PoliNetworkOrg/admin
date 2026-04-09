import Image from "next/image"
import bigBlueSvg from "@/assets/svg/shapes/big-blue.svg"
import bigTealSvg from "@/assets/svg/shapes/big-teal.svg"
import looperSvg from "@/assets/svg/shapes/looper.svg"
import smallBlueSvg from "@/assets/svg/shapes/small-blue.svg"
import { cn } from "@/lib/utils"

export type ShapeVariant = "big-blue" | "big-teal" | "small-blue" | "looper"

export type ShapeProps = {
  variant: ShapeVariant
  className?: string
}

export const Shape: React.FC<ShapeProps> = ({ variant, className }) => {
  const getShapeSrc = () => {
    switch (variant) {
      case "big-blue":
        return bigBlueSvg
      case "big-teal":
        return bigTealSvg
      case "small-blue":
        return smallBlueSvg
      case "looper":
        return looperSvg
      default:
        return ""
    }
  }

  return <Image src={getShapeSrc()} aria-hidden alt="" className={cn(className, "-z-10 absolute select-none")} />
}
