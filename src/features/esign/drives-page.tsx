import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { KeyRound, Plus, Search, TriangleAlert, UsersRound, X } from "lucide-react"
import { useId, useMemo, useState } from "react"

import { fieldControl, LoadingButton, SectionCard } from "@/components/primitives"
import { appToast, PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatDateTime } from "@/lib/format"
import { cn } from "@/lib/utils"

import { setEsignDriveAccess } from "./drives.functions"

type Rule = { roles: string[]; permissions: string[] }
type Entry = { key: string; name: string }
type Catalog = { roles: Entry[]; permissions: Entry[] }
type DriveAccess = {
  id: string
  label: string
  request: Rule
  sign: Rule
  updatedAt: Date | string | null
}

const same = (a: Rule, b: Rule) => a.roles.join() === b.roles.join() && a.permissions.join() === b.permissions.join()

/** Signatures › Drives: which roles and permissions may use each OneDrive/SharePoint drive. */
export function EsignDrivesPage({ drives, catalog }: { drives: DriveAccess[]; catalog: Catalog }) {
  return (
    <>
      <PageBar width="settings" description="Choose who can use each drive. Without a choice, the defaults apply." />
      <PageContent width="settings">
        <div className="flex max-w-[760px] flex-col gap-4">
          {drives.length === 0 && (
            <SectionCard>
              <p className="text-[14px] text-(--pn-fg-muted)">No drives are configured on the backend.</p>
            </SectionCard>
          )}
          {drives.map((drive) => (
            <DriveCard key={drive.id} drive={drive} catalog={catalog} />
          ))}
        </div>
      </PageContent>
    </>
  )
}

function DriveCard({ drive, catalog }: { drive: DriveAccess; catalog: Catalog }) {
  const router = useRouter()
  const canEdit = useCan("esign:drives:manage")
  const setFn = useServerFn(setEsignDriveAccess)
  const [request, setRequest] = useState<Rule>(drive.request)
  const [sign, setSign] = useState<Rule>(drive.sign)
  const [saving, setSaving] = useState(false)
  const dirty = !same(request, drive.request) || !same(sign, drive.sign)

  async function save() {
    setSaving(true)
    try {
      await setFn({ data: { driveId: drive.id, request, sign } })
    } catch (error) {
      console.error(error)
      appToast.error(error instanceof Error ? error.message : "Couldn't save the access.")
      setSaving(false)
      return
    }
    try {
      await router.invalidate({ sync: true })
    } catch (error) {
      console.error(error)
    }
    setSaving(false)
    appToast.success(`Access to ${drive.label} saved.`)
  }

  return (
    <SectionCard
      title={drive.label}
      action={
        canEdit ? (
          <div className="flex items-center gap-2">
            {dirty && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setRequest(drive.request)
                  setSign(drive.sign)
                }}
              >
                Discard
              </Button>
            )}
            <LoadingButton size="sm" pending={saving} disabled={!dirty} onClick={save}>
              Save
            </LoadingButton>
          </div>
        ) : undefined
      }
    >
      <div className="flex flex-col gap-5">
        <RuleEditor
          title="Request signatures"
          help="Browse the drive, use its PDFs and folders in requests, and see its requests. People also need Manage signature requests."
          fallback="Default: everyone who can manage signature requests"
          rule={request}
          catalog={catalog}
          disabled={!canEdit}
          onChange={setRequest}
        />
        <RuleEditor
          title="Be asked to sign"
          help="Who can be chosen to sign its documents. Someone who loses access can no longer sign the documents still waiting for them."
          fallback="Default: everyone who can sign"
          rule={sign}
          catalog={catalog}
          disabled={!canEdit}
          onChange={setSign}
        />
        {drive.updatedAt && (
          <p className="text-[12px] text-(--pn-fg-muted)">Changed on {formatDateTime(new Date(drive.updatedAt))}</p>
        )}
      </div>
    </SectionCard>
  )
}

function RuleEditor({
  title,
  help,
  fallback,
  rule,
  catalog,
  disabled,
  onChange,
}: {
  title: string
  help: string
  /** Who qualifies while the rule is empty. */
  fallback: string
  rule: Rule
  catalog: Catalog
  disabled: boolean
  onChange: (rule: Rule) => void
}) {
  const searchId = useId()
  const [query, setQuery] = useState("")
  const [open, setOpen] = useState(false)
  const roleNames = useMemo(() => new Map(catalog.roles.map((r) => [r.key, r.name])), [catalog])
  const permissionNames = useMemo(() => new Map(catalog.permissions.map((p) => [p.key, p.name])), [catalog])

  const needle = query.trim().toLocaleLowerCase()
  const matches = (entry: Entry) => needle === "" || `${entry.name} ${entry.key}`.toLocaleLowerCase().includes(needle)
  const roles = catalog.roles.filter((r) => !rule.roles.includes(r.key) && matches(r))
  const permissions = catalog.permissions.filter((p) => !rule.permissions.includes(p.key) && matches(p))
  const empty = rule.roles.length === 0 && rule.permissions.length === 0

  function add(kind: keyof Rule, key: string) {
    onChange({ ...rule, [kind]: [...rule[kind], key].sort() })
    setQuery("")
  }

  function remove(kind: keyof Rule, key: string) {
    onChange({ ...rule, [kind]: rule[kind].filter((k) => k !== key) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div>
        <h3 className="text-[14px] font-semibold">{title}</h3>
        <p className="text-[13px] text-pretty text-(--pn-fg-muted)">{help}</p>
      </div>
      <ul aria-label={`${title}: allowed roles and permissions`} className="flex flex-wrap items-center gap-1.5">
        {empty && <li className="text-[13px] text-(--pn-fg-muted)">{fallback}</li>}
        {rule.roles.map((key) => (
          <AccessChip
            key={`role-${key}`}
            icon={UsersRound}
            label={roleNames.get(key) ?? key}
            detail={`Role · ${key}`}
            unknown={!roleNames.has(key)}
            disabled={disabled}
            onRemove={() => remove("roles", key)}
          />
        ))}
        {rule.permissions.map((key) => (
          <AccessChip
            key={`permission-${key}`}
            icon={KeyRound}
            label={permissionNames.get(key) ?? key}
            detail={`Permission · ${key}`}
            unknown={!permissionNames.has(key)}
            disabled={disabled}
            onRemove={() => remove("permissions", key)}
          />
        ))}
      </ul>
      {!empty && (
        <p className="text-[12px] text-(--pn-fg-muted)">
          Anyone with at least one of these roles or permissions qualifies.
        </p>
      )}
      {!disabled && (
        <div className="relative max-w-[420px]">
          <Search
            aria-hidden
            className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
          />
          <Input
            id={searchId}
            aria-label={`Add a role or permission to ${title}`}
            placeholder="Add a role or permission…"
            value={query}
            className={cn(fieldControl, "h-9 pl-9")}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onBlur={() => setOpen(false)}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
          />
          {open && (
            <div className="mt-1 max-h-72 overflow-y-auto rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface) p-1">
              <OptionGroup label="Roles" icon={UsersRound} entries={roles} onPick={(key) => add("roles", key)} />
              <OptionGroup
                label="Permissions"
                icon={KeyRound}
                entries={permissions}
                onPick={(key) => add("permissions", key)}
              />
              {roles.length === 0 && permissions.length === 0 && (
                <p className="px-2 py-2 text-[13px] text-(--pn-fg-muted)">
                  {catalog.roles.length + catalog.permissions.length === 0
                    ? "The identity provider hasn't shared its roles and permissions yet."
                    : "Nothing matches."}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function OptionGroup({
  label,
  icon: Icon,
  entries,
  onPick,
}: {
  label: string
  icon: typeof KeyRound
  entries: Entry[]
  onPick: (key: string) => void
}) {
  if (entries.length === 0) return null
  return (
    <div className="py-1">
      <p className="px-2 py-1 text-[12px] text-(--pn-fg-muted)">{label}</p>
      {entries.map((entry) => (
        <button
          key={entry.key}
          type="button"
          // Keeps the input focused, so the list stays open while picking several.
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onPick(entry.key)}
          className="flex h-9 w-full items-center gap-2 rounded-(--pn-r-2) px-2 text-left text-[13px] hover:bg-(--pn-hover)"
        >
          <Icon aria-hidden className="size-4 shrink-0 text-(--pn-fg-muted)" />
          <span className="min-w-0 flex-1 truncate">{entry.name}</span>
          <span className="truncate font-mono text-[12px] text-(--pn-fg-muted)">{entry.key}</span>
          <Plus aria-hidden className="size-3.5 shrink-0 text-(--pn-fg-muted)" />
        </button>
      ))}
    </div>
  )
}

function AccessChip({
  icon: Icon,
  label,
  detail,
  unknown,
  disabled,
  onRemove,
}: {
  icon: typeof KeyRound
  label: string
  detail: string
  /** Not in the identity provider's catalog: renamed or deleted there, so nobody holds it. */
  unknown: boolean
  disabled: boolean
  onRemove: () => void
}) {
  return (
    <li
      title={unknown ? `${detail} — not known to the identity provider` : detail}
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-(--pn-r-full) border pr-1 pl-2.5 text-[13px]",
        unknown
          ? "border-(--pn-warning-solid)/40 bg-(--pn-warning-bg) text-(--pn-warning-fg)"
          : "border-(--pn-line) bg-(--pn-surface)"
      )}
    >
      {unknown ? (
        <TriangleAlert aria-hidden className="size-3.5 shrink-0" />
      ) : (
        <Icon aria-hidden className="size-3.5 shrink-0 text-(--pn-fg-muted)" />
      )}
      <span className="max-w-[220px] truncate">{label}</span>
      {!disabled && (
        <button
          type="button"
          aria-label={`Remove ${label}`}
          onClick={onRemove}
          className="grid size-6 place-items-center rounded-full text-(--pn-fg-muted) hover:bg-(--pn-hover) hover:text-(--pn-fg)"
        >
          <X aria-hidden className="size-3.5" />
        </button>
      )}
    </li>
  )
}
