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
    <section className="flex items-end justify-between gap-6 border-b border-border pb-5 max-[640px]:items-start max-[640px]:flex-col">
      <div>
        <p className="text-[10px] font-semibold tracking-[0.1em] text-primary uppercase">{eyebrow}</p>
        <h2 className="mt-1.5 text-2xl font-semibold tracking-[-0.035em]">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action}
    </section>
  )
}
