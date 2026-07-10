import { Plus, Search } from "lucide-react"
import { type ReactNode, useId } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DataToolbar({
  title,
  description,
  count,
  onSearch,
  action,
  onAction,
  children,
}: {
  title: string
  description: string
  count: number
  onSearch?: (value: string) => void
  action?: string
  onAction?: () => void
  children?: ReactNode
}) {
  const searchId = useId()

  return (
    <>
      <section className="flex flex-col items-start justify-between gap-4 border-b border-border pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="font-mono text-[10px] leading-[1.3] font-medium tracking-[0.13em] text-muted-foreground">
            DIRECTORY
          </p>
          <h2 className="mt-2 font-serif text-[25px] leading-[1.1] tracking-[-0.05em]">{title}</h2>
          <p className="mt-2 text-xs text-muted-foreground">{description}</p>
        </div>
        {action && onAction && (
          <Button
            className="h-9 rounded-none bg-primary px-3 text-[11px] font-semibold text-primary-foreground hover:bg-primary/85"
            onClick={onAction}
          >
            <Plus data-icon="inline-start" />
            {action}
          </Button>
        )}
      </section>
      <section className="flex flex-wrap items-center gap-3 py-4">
        <label
          htmlFor={searchId}
          className="relative flex h-9 w-full max-w-[300px] items-center border border-border bg-card text-muted-foreground sm:w-[300px]"
        >
          <Search className="pointer-events-none absolute left-2.5" />
          <Input
            id={searchId}
            aria-label={`Search ${title}`}
            className="h-full rounded-none border-0 bg-transparent pl-8 text-xs shadow-none focus-visible:ring-0"
            onChange={(event) => onSearch?.(event.target.value)}
            placeholder="Filter records…"
          />
        </label>
        <span className="ml-auto text-[11px] text-muted-foreground max-sm:ml-0">
          <b className="text-foreground">{count}</b> records
        </span>
        {children}
      </section>
    </>
  )
}
