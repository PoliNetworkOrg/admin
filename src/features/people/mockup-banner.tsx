import { Construction } from "lucide-react"

import { inlineLink } from "@/components/primitives"
import { cn } from "@/lib/utils"

/** The roadmap issue that rebuilds each mocked-up feature. */
const PHASES = {
  2: { issue: 144, rebuild: "Soci, fees and receipts are rebuilt on Microsoft 365 members" },
  3: { issue: 145, rebuild: "The census is rebuilt" },
} as const

/**
 * Marks a People page or card that is an unconnected UI mockup: it shows static sample data, makes no backend call,
 * and its actions are disabled.
 */
export function MockupBanner({ phase, className }: { phase: keyof typeof PHASES; className?: string }) {
  const { issue, rebuild } = PHASES[phase]
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-(--pn-r-3) border border-(--pn-warning-fg)/30 bg-(--pn-warning-bg) p-3 text-[13px] leading-5 text-(--pn-fg)",
        className
      )}
    >
      <Construction aria-hidden className="mt-0.5 size-4 shrink-0 text-(--pn-warning-fg)" />
      <p className="min-w-0 flex-1 text-pretty">
        <strong className="font-semibold">Unconnected mockup, not real data.</strong> Everything here is sample data and
        every action is disabled. {rebuild} in{" "}
        <a
          href={`https://github.com/PoliNetworkOrg/admin/issues/${issue}`}
          target="_blank"
          rel="noreferrer"
          className={inlineLink}
        >
          Phase {phase} (#{issue})
        </a>
        .
      </p>
    </div>
  )
}
