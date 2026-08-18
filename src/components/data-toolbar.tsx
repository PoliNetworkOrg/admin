import { Search, X } from "lucide-react"
import { type ReactNode, useDeferredValue, useEffect, useId, useRef, useState } from "react"
import { PageHeader } from "@/components/page-header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

export function DataToolbar({
  title,
  description,
  count,
  total,
  onSearch,
  searchPlaceholder,
  action,
  children,
  eyebrow = "Directory",
}: {
  title: string
  description: string
  count: number
  total?: number
  onSearch?: (value: string) => void
  searchPlaceholder?: string
  action?: ReactNode
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

  const resultLabel =
    total !== undefined && total !== count
      ? `${count.toLocaleString()} of ${total.toLocaleString()}`
      : count.toLocaleString()

  return (
    <>
      <PageHeader eyebrow={eyebrow} title={title} description={description} action={action} />
      <section
        className="my-5 flex min-h-16 flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-3 shadow-[0_1px_2px_rgb(15_23_42/4%)] dark:shadow-none"
        aria-label={`${title} controls`}
      >
        {onSearch && (
          <div className="relative w-full sm:max-w-sm">
            <label htmlFor={searchId} className="sr-only">
              Search {title}
            </label>
            <Search className="pointer-events-none absolute top-1/2 left-3 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              id={searchId}
              type="search"
              aria-label={`Search ${title}`}
              className="pr-9 pl-9"
              value={searchValue}
              onChange={(event) => setSearchValue(event.target.value)}
              placeholder={searchPlaceholder ?? `Search ${title.toLocaleLowerCase()}…`}
            />
            {searchValue && (
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground"
                onClick={() => setSearchValue("")}
                aria-label={`Clear ${title} search`}
              >
                <X />
              </Button>
            )}
          </div>
        )}
        {children}
        <p className="ml-auto text-xs text-muted-foreground max-sm:ml-0 max-sm:w-full">
          <span className="font-medium text-foreground">{resultLabel}</span> {count === 1 ? "result" : "results"}
        </p>
      </section>
    </>
  )
}
