import {
  AlertCircle,
  Award,
  Book,
  Bookmark,
  BookOpen,
  Briefcase,
  Calendar,
  CheckCircle,
  Clock,
  Coffee,
  Compass,
  Cpu,
  CreditCard,
  DollarSign,
  Edit,
  FileText,
  Globe,
  GraduationCap,
  HelpCircle,
  Home,
  Info,
  Laptop,
  type LucideIcon,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  Phone,
  Send,
  Shield,
  User,
  Users,
  Wifi,
} from "lucide-react"
import type React from "react"

export const FAQ_ICONS_MAP = {
  "help-circle": HelpCircle,
  info: Info,
  "book-open": BookOpen,
  book: Book,
  bookmark: Bookmark,
  award: Award,
  "graduation-cap": GraduationCap,
  "file-text": FileText,
  edit: Edit,
  calendar: Calendar,
  clock: Clock,
  compass: Compass,
  "map-pin": MapPin,
  briefcase: Briefcase,
  "credit-card": CreditCard,
  "dollar-sign": DollarSign,
  users: Users,
  user: User,
  globe: Globe,
  send: Send,
  mail: Mail,
  phone: Phone,
  "message-circle": MessageCircle,
  "message-square": MessageSquare,
  wifi: Wifi,
  cpu: Cpu,
  laptop: Laptop,
  shield: Shield,
  home: Home,
  coffee: Coffee,
  "alert-circle": AlertCircle,
  "check-circle": CheckCircle,
} as const satisfies Record<string, LucideIcon>

export const DEFAULT_FAQ_ICON = "help-circle"

export type FAQIconName = keyof typeof FAQ_ICONS_MAP

export function isFAQIconName(name: string): name is FAQIconName {
  return name in FAQ_ICONS_MAP
}

export function FAQCategoryIcon({
  icon,
  className,
  ...props
}: {
  icon?: string | null
  className?: string
} & Omit<React.ComponentProps<"svg">, "name">) {
  const IconComponent = icon && isFAQIconName(icon) ? FAQ_ICONS_MAP[icon] : HelpCircle
  return <IconComponent className={className} {...props} />
}
