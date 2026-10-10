import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Check, Search, X } from "lucide-react"
import { type KeyboardEvent, useId, useState } from "react"

import {
  buttonMotion,
  checkboxControl,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
  LabelTreeSelector,
  NavCard,
  PlatformGlyph,
  SectionEmpty,
  SegmentedControl,
} from "@/components/primitives"
import { appToast, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { DEFAULT_GROUP_LABEL_COLOR } from "@/features/group-labels/group-labels.constants"
import { createGroupLabel, tagGroup } from "@/features/group-labels/group-labels.functions"
import { focusFieldSoon, useResetOnOpen } from "@/features/group-labels/label-name-field"
import { formatLabelBreadcrumb } from "@/features/group-labels/label-tree"
import type { GroupLabel } from "@/features/group-labels/types"
import { createWhatsappGroup } from "@/features/whatsapp/groups.functions"
import { isValidWhatsappInviteLink, WHATSAPP_INVITE_LINK_MAX } from "@/features/whatsapp/whatsapp.validation"
import type { GroupWithLabels, TgGroup } from "@/lib/api/types"
import { errorMessage } from "@/lib/errors"
import { pluralize } from "@/lib/format"
import { cn } from "@/lib/utils"

import { groupSearchText, normalizeGroupQuery, useTelegramTags } from "./label-groups"

type Step = "choose" | "new" | "existing"
type GroupType = GroupWithLabels["type"]
type GroupRef = { type: GroupType; id: number; title: string }

const TITLE_MAX = 200
const LINK_ERROR = "Enter a valid WhatsApp group invite link."
const platformName = { tg: "Telegram", wa: "WhatsApp" } satisfies Record<GroupType, string>
const PLATFORMS = ["tg", "wa"] as const satisfies readonly GroupType[]

const descriptions = {
  choose: "Create a brand new group, or categorize groups that already exist.",
  new: "There's no bot managing WhatsApp groups yet, so this is just a manual record.",
  existing: "Pick one or more groups to categorize.",
} satisfies Record<Step, string>

function refKey(ref: { type: GroupType; id: number }) {
  return `${ref.type}:${ref.id}`
}

type AddGroupToLabelDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The category path or tag the groups get. */
  path: string
  labels: GroupLabel[]
  groups: GroupWithLabels[]
  tgGroups: TgGroup[]
  /**
   * Off on tag pages: a group created there would carry the tag and no category, so once published it would sit on
   * the site uncategorized. The dialog then opens on the existing-groups step.
   */
  allowCreate?: boolean
}

/** AddGroupToLabelDialog: create a WhatsApp group with this label, or label existing groups. */
export function AddGroupToLabelDialog({
  open,
  onOpenChange,
  path,
  labels,
  groups,
  tgGroups,
  allowCreate = true,
}: AddGroupToLabelDialogProps) {
  const router = useRouter()
  const canCreateWhatsapp = useCan("wa:groups:manage")
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const createWhatsappGroupFn = useServerFn(createWhatsappGroup)
  const tagGroupFn = useServerFn(tagGroup)
  const initialStep: Step = allowCreate && canCreateWhatsapp ? "choose" : "existing"
  const ids = { title: useId(), link: useId(), hide: useId(), tags: useId(), search: useId() }

  const [step, setStep] = useState<Step>(initialStep)
  const [platform, setPlatform] = useState<GroupType>("tg")
  const [query, setQuery] = useState("")
  const [selected, setSelected] = useState<GroupRef[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [title, setTitle] = useState("")
  const [link, setLink] = useState("")
  const [linkError, setLinkError] = useState<string | null>(null)
  const [hide, setHide] = useState(false)
  const [tags, setTags] = useState<string[]>([])
  const telegramTags = useTelegramTags(tgGroups)

  useResetOnOpen(open, () => {
    setStep(initialStep)
    setPlatform("tg")
    setQuery("")
    setSelected([])
    setTitle("")
    setLink("")
    setLinkError(null)
    setHide(false)
    setTags([])
  })

  const breadcrumb = formatLabelBreadcrumb(path)
  const selectedKeys = new Set(selected.map(refKey))
  const normalizedQuery = normalizeGroupQuery(query)
  const pickable = groups.filter((group) => {
    if (group.type !== platform || group.labels.includes(path)) return false
    return !normalizedQuery || groupSearchText(group, telegramTags).includes(normalizedQuery)
  })

  /** The first group filed under a new path (e.g. a bare root) also creates its label row. */
  async function ensureLabelExists() {
    if (labels.some((label) => label.label === path)) return
    await createGroupLabelFn({ data: { label: path, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
  }

  async function submitNew() {
    const trimmedLink = link.trim()
    if (!isValidWhatsappInviteLink(trimmedLink)) {
      setLinkError(LINK_ERROR)
      return
    }
    const trimmedTitle = title.trim()
    let created: { id: number }
    try {
      await ensureLabelExists()
      created = await createWhatsappGroupFn({ data: { title: trimmedTitle, link: trimmedLink, hide } })
    } catch (cause) {
      console.error(cause)
      throw new Error(errorMessage(cause, "Couldn't add the group. Check the details and try again."))
    }

    const labelsToApply = [path, ...tags]
    const results = await Promise.allSettled(
      labelsToApply.map((label) => tagGroupFn({ data: { groupId: created.id, type: "wa", label } }))
    )
    const failed = labelsToApply.filter((_, index) => results[index]?.status === "rejected")
    await router.invalidate({ sync: true })
    onOpenChange(false)
    if (failed.length > 0) {
      console.error(results)
      appToast.warning(
        `${trimmedTitle} was added, but couldn't be labeled ${failed.map(formatLabelBreadcrumb).join(", ")}.`
      )
    } else {
      appToast.success(`${trimmedTitle} added and labeled ${breadcrumb}.`)
    }
  }

  async function submitExisting() {
    const submitted = [...selected]
    try {
      await ensureLabelExists()
    } catch (cause) {
      console.error(cause)
      throw new Error(errorMessage(cause, "Couldn't label the groups. Check your permissions and try again."))
    }
    const results = await Promise.allSettled(
      submitted.map((ref) => tagGroupFn({ data: { groupId: ref.id, type: ref.type, label: path } }))
    )
    const failed = results.filter((result) => result.status === "rejected").length
    if (failed > 0) {
      console.error(results)
      // Some groups may already be labeled: refresh so the page shows what was saved, and keep only the rest.
      setSelected(submitted.filter((_, index) => results[index]?.status === "rejected"))
      await router.invalidate({ sync: true })
      throw new Error(
        failed === submitted.length
          ? "Couldn't label the groups. Check your permissions and try again."
          : `${failed} of ${pluralize(submitted.length, "group")} couldn't be labeled; the rest were. Try again.`
      )
    }
    await router.invalidate({ sync: true })
    const [only] = submitted
    appToast.success(
      submitted.length === 1 && only
        ? `${only.title} labeled ${breadcrumb}.`
        : `${submitted.length} groups labeled ${breadcrumb}.`
    )
    onOpenChange(false)
  }

  function toggle(group: GroupRef) {
    const key = refKey(group)
    setSelected((current) =>
      current.some((ref) => refKey(ref) === key)
        ? current.filter((ref) => refKey(ref) !== key)
        : [...current, { type: group.type, id: group.id, title: group.title }]
    )
  }

  function toggleTags(changed: GroupLabel[], select: boolean) {
    const names = changed.map((label) => label.label)
    setTags((current) =>
      select ? [...new Set([...current, ...names])] : current.filter((name) => !names.includes(name))
    )
  }

  const back =
    step === "choose" || !allowCreate || !canCreateWhatsapp ? undefined : (
      <Button
        type="button"
        variant="ghost"
        disabled={submitting}
        onClick={() => setStep("choose")}
        className={buttonMotion}
      >
        <ArrowLeft aria-hidden data-icon="inline-start" />
        Back
      </Button>
    )

  const newReady = title.trim() !== "" && link.trim() !== ""

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      size="lg"
      title={`Add group to ${breadcrumb}`}
      description={descriptions[step]}
      noun="group"
      dirty={step === "new" ? title !== "" || link !== "" || tags.length > 0 : selected.length > 0}
      submitLabel={
        step === "choose"
          ? undefined
          : step === "existing" && selected.length > 1
            ? `Add ${selected.length} groups`
            : "Add group"
      }
      canSubmit={step === "new" ? newReady : step === "existing" && selected.length > 0}
      onSubmit={async () => {
        setSubmitting(true)
        try {
          await (step === "new" ? submitNew() : submitExisting())
        } finally {
          setSubmitting(false)
        }
      }}
      submitOnEnter={step === "new"}
      footerStart={back}
    >
      <fieldset disabled={submitting} className="contents">
        {step === "choose" && (
          <div className="grid gap-3 min-[480px]:grid-cols-2">
            <NavCard
              title="New group"
              description="Create a group that doesn't exist yet."
              onClick={() => {
                setStep("new")
                focusFieldSoon(ids.title)
              }}
            />
            <NavCard
              title="Existing groups"
              description="Label groups you already have."
              onClick={() => {
                setStep("existing")
                focusFieldSoon(ids.search)
              }}
            />
          </div>
        )}

        {step === "new" && (
          <>
            <FormField label="Title" htmlFor={ids.title} counter={{ length: title.length, max: TITLE_MAX }}>
              <Input
                id={ids.title}
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Gruppo Informatica 1"
                maxLength={TITLE_MAX}
                autoComplete="off"
                className={cn("h-9", fieldControl)}
              />
            </FormField>
            <FormField
              label="Invite link"
              htmlFor={ids.link}
              hint="Must start with https://chat.whatsapp.com/"
              error={linkError}
            >
              <Input
                id={ids.link}
                type="url"
                value={link}
                onChange={(event) => setLink(event.target.value)}
                onBlur={() => {
                  if (linkError !== null) setLinkError(isValidWhatsappInviteLink(link.trim()) ? null : LINK_ERROR)
                }}
                placeholder="https://chat.whatsapp.com/…"
                maxLength={WHATSAPP_INVITE_LINK_MAX}
                autoComplete="off"
                spellCheck={false}
                aria-invalid={linkError !== null || undefined}
                aria-describedby={fieldHintId(ids.link)}
                className={cn("h-9", fieldControl)}
              />
            </FormField>
            <label htmlFor={ids.hide} className="flex cursor-pointer items-start gap-3">
              <Checkbox
                id={ids.hide}
                checked={hide}
                onCheckedChange={(checked) => setHide(checked)}
                className={checkboxControl}
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-[13px] leading-5 font-medium text-(--pn-fg)">Hide until published</span>
                <span className="text-xs text-(--pn-fg-muted)">
                  Keeps this group off the site until you make it visible later.
                </span>
              </span>
            </label>
            <div className="flex flex-col gap-1.5">
              <p id={ids.tags} className="text-[13px] leading-5 font-medium text-(--pn-fg)">
                Attributes and publications <span className="font-normal text-(--pn-fg-muted)">(optional)</span>
              </p>
              <div role="group" aria-labelledby={ids.tags}>
                <LabelTreeSelector allLabels={labels} selected={tags} onToggleMany={toggleTags} tagsOnly />
              </div>
            </div>
          </>
        )}

        {step === "existing" && (
          <>
            <div className="flex flex-col gap-2 min-[480px]:flex-row min-[480px]:items-center">
              <SegmentedControl
                label="Platform"
                items={PLATFORMS.map((type) => ({
                  value: type,
                  label: platformName[type],
                  icon: <PlatformGlyph platform={type} className="text-current" />,
                }))}
                value={platform}
                onValueChange={setPlatform}
              />
              <PickSearch
                id={ids.search}
                value={query}
                onChange={setQuery}
                placeholder={`Search ${platformName[platform]} groups…`}
              />
            </div>

            {selected.length > 0 && (
              <section
                aria-label={pluralize(selected.length, "selected group")}
                className="flex max-h-[76px] min-w-0 items-start gap-2 overflow-y-auto"
              >
                <span className="pt-0.5 text-xs font-medium whitespace-nowrap text-(--pn-fg-muted) tabular-nums">
                  {selected.length} selected
                </span>
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                  {selected.map((ref) => (
                    <button
                      key={refKey(ref)}
                      type="button"
                      aria-label={`Remove ${ref.title}`}
                      title={ref.title}
                      onClick={() => toggle(ref)}
                      className="inline-flex h-6 max-w-56 items-center gap-1.5 rounded-(--pn-r-full) bg-(--pn-muted) pr-1.5 pl-2 text-xs font-medium text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-nav-active)"
                    >
                      <PlatformGlyph platform={ref.type} className="size-3" />
                      <span className="truncate">{ref.title}</span>
                      <X aria-hidden className="size-3 shrink-0 text-(--pn-fg-muted)" />
                    </button>
                  ))}
                </div>
              </section>
            )}

            <div
              role="group"
              aria-label={`${platformName[platform]} groups`}
              className="h-64 min-w-0 shrink-0 overflow-y-auto rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-surface) p-1"
            >
              {pickable.length > 0 ? (
                pickable.map((group) => {
                  const pressed = selectedKeys.has(refKey(group))
                  const tag = group.type === "tg" ? telegramTags.get(group.id) : null
                  return (
                    <button
                      key={refKey(group)}
                      type="button"
                      aria-pressed={pressed}
                      onClick={() => toggle(group)}
                      className="flex h-10 w-full min-w-0 items-center gap-3 rounded-(--pn-r-2) px-3 text-left text-[13px] text-(--pn-fg) transition-[background-color] duration-120 hover:bg-(--pn-muted) aria-pressed:bg-(--pn-accent-soft) aria-pressed:hover:bg-(--pn-accent-soft-hover)"
                    >
                      <span className="min-w-0 flex-1 truncate" title={group.title}>
                        {group.title}
                      </span>
                      {tag && <span className="shrink-0 font-mono text-xs text-(--pn-fg-muted)">@{tag}</span>}
                      <Check
                        aria-hidden
                        className={cn("size-4 shrink-0 text-(--pn-accent)", pressed ? "opacity-100" : "opacity-0")}
                      />
                    </button>
                  )
                })
              ) : (
                <SectionEmpty title="No matching groups" className="px-3" />
              )}
            </div>
          </>
        )}
      </fieldset>
    </FormDialog>
  )
}

type PickSearchProps = { id: string; value: string; onChange: (value: string) => void; placeholder: string }

/** Dialog-local search: not the page search, so no `/` shortcut; the dialog turns Enter-to-submit off on this step. */
function PickSearch({ id, value, onChange, placeholder }: PickSearchProps) {
  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Escape" && value !== "") {
      event.preventDefault()
      event.stopPropagation()
      onChange("")
    }
  }

  return (
    <div className="relative min-w-0 flex-1">
      <Search
        aria-hidden
        className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-(--pn-fg-muted)"
      />
      <Input
        id={id}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        aria-label={placeholder.replace(/…$/, "")}
        autoComplete="off"
        spellCheck={false}
        className={cn("h-9 pl-8 [&::-webkit-search-cancel-button]:appearance-none", fieldControl)}
      />
    </div>
  )
}
