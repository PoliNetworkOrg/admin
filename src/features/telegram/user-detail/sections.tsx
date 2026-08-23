import { Link } from "@tanstack/react-router"
import { ArrowLeft, type LucideIcon } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export function UserDetailBackLink() {
  return (
    <Link
      to="/dashboard/telegram/users"
      className="flex w-max items-center gap-1.5 font-mono text-[11px] text-primary hover:underline"
    >
      <ArrowLeft className="size-4" /> Back to users
    </Link>
  )
}

export function SummaryCard({
  icon: Icon,
  label,
  actions,
  children,
}: {
  icon: LucideIcon
  label: string
  actions?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Card size="sm">
      <CardHeader className="gap-3 p-5 pb-3">
        <Icon className="size-5 text-primary" />
        <CardTitle className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex grow flex-col px-5 pb-5 pt-0">
        <div className="grow">{children}</div>
        {actions && <div className="mt-4 flex flex-wrap gap-2 border-t border-border pt-3">{actions}</div>}
      </CardContent>
    </Card>
  )
}

export function Definition({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="font-mono text-[9px] text-muted-foreground">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  )
}

export function SectionEmpty({ text }: { text: string }) {
  return (
    <p className="rounded-xl border border-dashed border-border bg-card px-5 py-8 text-center text-xs text-muted-foreground">
      {text}
    </p>
  )
}

export function DetailSection({
  icon: Icon,
  title,
  count,
  action,
  children,
}: {
  icon: LucideIcon
  title: string
  count: number
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section className="mt-[34px]">
      <header className="mb-4 flex items-center justify-between gap-4">
        <span className="flex items-center gap-2">
          <Icon className="size-5 text-primary" />
          <h2 className="text-lg font-semibold tracking-[-0.025em]">{title}</h2>
        </span>
        <span className="flex items-center gap-3">
          {action}
          <b className="font-mono text-[10px] text-muted-foreground">{count}</b>
        </span>
      </header>
      {children}
    </section>
  )
}
