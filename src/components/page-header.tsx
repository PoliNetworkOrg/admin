import type { ReactNode } from "react"

export function PageHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string
  title: string
  description: string
  action?: ReactNode
}) {
  return (
    <header className="flex items-start justify-between gap-8 max-[640px]:flex-col max-[640px]:gap-4">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.1em] text-primary uppercase">{eyebrow}</p>
        <h2 className="mt-2 text-[clamp(1.75rem,3vw,2.25rem)] leading-[1.08] font-semibold tracking-[-0.045em]">
          {title}
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0 max-[640px]:w-full max-[640px]:[&>*]:w-full">{action}</div>}
    </header>
  )
}
