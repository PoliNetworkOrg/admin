import { Plus, Search } from "lucide-react"
import { type ReactNode, useDeferredValue, useEffect, useId, useRef, useState } from "react"
import { PageHeader } from "@/components/page-header"
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
  eyebrow = "Directory",
}: {
  title: string
  description: string
  count: number
  onSearch?: (value: string) => void
  action?: string
  onAction?: () => void
  children?: ReactNode
  eyebrow?: string
}) {
  const searchId = useId()
  const [searchValue, setSearchValue] = useState("")
  const deferredSearchValue = useDeferredValue(searchValue)
  const onSearchRef = useRef(onSearch)
  onSearchRef.current = onSearch

  useEffect(() => {
    onSearchRef.current?.(deferredSearchValue)
  }, [deferredSearchValue])

  return (
    <>
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        description={description}
        action={
          action && onAction ? (
            <Button onClick={onAction}>
              <Plus data-icon="inline-start" />
              {action}
            </Button>
          ) : undefined
        }
      />
      <section className="flex flex-wrap items-center gap-3 py-4" aria-label={`${title} controls`}>
        <label
          htmlFor={searchId}
          className="relative flex h-10 w-full max-w-[320px] items-center rounded-lg border border-input bg-card text-muted-foreground shadow-xs sm:w-[320px]"
        >
          <Search className="pointer-events-none absolute left-3 size-4" />
          <Input
            id={searchId}
            aria-label={`Search ${title}`}
            className="h-full border-0 bg-transparent pl-9 text-sm shadow-none focus-visible:ring-0"
            value={searchValue}
            onChange={(event) => setSearchValue(event.target.value)}
            placeholder="Filter records…"
          />
        </label>
        <span className="ml-auto text-xs text-muted-foreground max-sm:ml-0">
          <b className="font-mono font-medium text-foreground">{count}</b> records
        </span>
        {children}
      </section>
    </>
  )
}
