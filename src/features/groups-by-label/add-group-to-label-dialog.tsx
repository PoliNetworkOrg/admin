import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, Check, LoaderCircle, Plus, Search, X } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { DEFAULT_GROUP_LABEL_COLOR } from "@/features/group-labels/group-labels.constants"
import { createGroupLabel, tagGroup } from "@/features/group-labels/group-labels.functions"
import { formatLabelBreadcrumb } from "@/features/group-labels/label-tree"
import { createWhatsappGroup } from "@/features/whatsapp/groups.functions"
import { WHATSAPP_LINK_PATTERN, WhatsappGroupFields } from "@/features/whatsapp/whatsapp-group-fields"
import type { TgGroup, TgGroupLabel, WaGroup } from "@/lib/api/types"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

type Step = "choose" | "new" | "existing"
type Platform = "telegram" | "whatsapp"

export function AddGroupToLabelDialog({
  path,
  labelExists,
  tgGroups,
  waGroups,
  tgLabelsByGroupId,
  waLabelsByGroupId,
}: {
  path: string
  labelExists: boolean
  tgGroups: TgGroup[]
  waGroups: WaGroup[]
  tgLabelsByGroupId: Map<number, TgGroupLabel[]>
  waLabelsByGroupId: Map<number, TgGroupLabel[]>
}) {
  const router = useRouter()
  const createGroupLabelFn = useServerFn(createGroupLabel)
  const createWhatsappGroupFn = useServerFn(createWhatsappGroup)
  const tagGroupFn = useServerFn(tagGroup)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("choose")
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [groupQuery, setGroupQuery] = useState("")
  const [selectedTgGroups, setSelectedTgGroups] = useState<TgGroup[]>([])
  const [selectedWaGroups, setSelectedWaGroups] = useState<WaGroup[]>([])
  const [title, setTitle] = useState("")
  const [link, setLink] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  const availableTgGroups = tgGroups.filter(
    (g) => !(tgLabelsByGroupId.get(g.telegramId) ?? []).some((l) => l.label === path)
  )
  const availableWaGroups = waGroups.filter((g) => !(waLabelsByGroupId.get(g.id) ?? []).some((l) => l.label === path))
  const normalizedGroupQuery = groupQuery.trim().toLocaleLowerCase()
  const filteredTgGroups = normalizedGroupQuery
    ? availableTgGroups.filter((g) => g.title.toLocaleLowerCase().includes(normalizedGroupQuery))
    : availableTgGroups
  const filteredWaGroups = normalizedGroupQuery
    ? availableWaGroups.filter((g) => g.title.toLocaleLowerCase().includes(normalizedGroupQuery))
    : availableWaGroups

  function reset() {
    setStep("choose")
    setPlatform(null)
    setGroupQuery("")
    setSelectedTgGroups([])
    setSelectedWaGroups([])
    setTitle("")
    setLink("")
    setError("")
  }

  function closeDialog() {
    setOpen(false)
    reset()
  }

  function toggleTgGroup(group: TgGroup) {
    setSelectedTgGroups((current) =>
      current.some((g) => g.telegramId === group.telegramId)
        ? current.filter((g) => g.telegramId !== group.telegramId)
        : [...current, group]
    )
  }

  function toggleWaGroup(group: WaGroup) {
    setSelectedWaGroups((current) =>
      current.some((g) => g.id === group.id) ? current.filter((g) => g.id !== group.id) : [...current, group]
    )
  }

  async function ensureLabelExists() {
    if (!labelExists) {
      await createGroupLabelFn({ data: { label: path, color: DEFAULT_GROUP_LABEL_COLOR, description: "" } })
    }
  }

  async function submitNew(event: React.FormEvent) {
    event.preventDefault()
    if (!title.trim() || !WHATSAPP_LINK_PATTERN.test(link.trim()) || pending) return
    setPending(true)
    setError("")
    try {
      await ensureLabelExists()
      const created = await createWhatsappGroupFn({ data: { title: title.trim(), link: link.trim() } })
      try {
        await tagGroupFn({ data: { groupId: created.id, type: "wa", label: path } })
      } catch (tagCause) {
        console.error(tagCause)
        toast.warning(
          `${title.trim()} was added, but could not be labeled "${formatLabelBreadcrumb(path)}". Assign it manually.`
        )
        closeDialog()
        try {
          await router.invalidate({ sync: true })
        } catch (refreshCause) {
          console.error(refreshCause)
          toast.warning("The group was added, but the latest group data could not be refreshed.")
        }
        return
      }
      toast.success(`${title.trim()} added and labeled "${formatLabelBreadcrumb(path)}".`)
      closeDialog()
      try {
        await router.invalidate({ sync: true })
      } catch (refreshCause) {
        console.error(refreshCause)
        toast.warning("The group was added and labeled, but the latest group data could not be refreshed.")
      }
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The group could not be created. Check the details and try again."))
    } finally {
      setPending(false)
    }
  }

  async function submitExisting() {
    if (pending) return
    const groupsToTag = platform === "telegram" ? selectedTgGroups : platform === "whatsapp" ? selectedWaGroups : []
    if (!groupsToTag.length) return
    setPending(true)
    setError("")
    try {
      await ensureLabelExists()
      const results = await Promise.allSettled(
        groupsToTag.map((group) =>
          tagGroupFn({
            data: {
              groupId: "telegramId" in group ? group.telegramId : group.id,
              type: "telegramId" in group ? "tg" : "wa",
              label: path,
            },
          })
        )
      )
      const failed = results.filter((result) => result.status === "rejected").length
      if (failed > 0) {
        // Some groups may have already been tagged even though others failed — refresh so the underlying
        // data reflects what's actually saved, instead of silently implying nothing happened.
        await router.invalidate({ sync: true })
        setError(
          failed === groupsToTag.length
            ? "The groups could not be labeled. Check your permissions and try again."
            : `${failed} of ${groupsToTag.length} group(s) couldn't be labeled — the rest were. Check your permissions and try again.`
        )
        return
      }
      toast.success(
        groupsToTag.length === 1
          ? `${groupsToTag[0].title} labeled "${formatLabelBreadcrumb(path)}".`
          : `${groupsToTag.length} groups labeled "${formatLabelBreadcrumb(path)}".`
      )
      closeDialog()
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The groups could not be labeled. Check your permissions and try again."))
    } finally {
      setPending(false)
    }
  }

  const selectedExistingCount =
    platform === "telegram" ? selectedTgGroups.length : platform === "whatsapp" ? selectedWaGroups.length : 0
  const canSubmitExisting = selectedExistingCount > 0

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        if (nextOpen) setOpen(true)
        else closeDialog()
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" /> Add group
      </DialogTrigger>
      <DialogContent className="grid-cols-[minmax(0,1fr)] overflow-x-hidden sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Add group to "{formatLabelBreadcrumb(path)}"</DialogTitle>
          <DialogDescription>
            {step === "choose" && "Create a brand new group, or categorize groups that already exist."}
            {step === "new" && "There's no bot managing WhatsApp groups yet, so this is just a manual record."}
            {step === "existing" &&
              (platform ? "Pick one or more groups to categorize." : "Which platform are the groups on?")}
          </DialogDescription>
        </DialogHeader>

        {step === "choose" && (
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setStep("new")}
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center hover:border-primary/50 hover:bg-accent"
            >
              <Plus className="size-5 text-primary" />
              <span className="text-sm font-medium">New group</span>
              <span className="text-xs text-muted-foreground">Create a group that doesn't exist yet.</span>
            </button>
            <button
              type="button"
              onClick={() => setStep("existing")}
              className="flex flex-col items-center gap-2 rounded-lg border border-border p-4 text-center hover:border-primary/50 hover:bg-accent"
            >
              <Search className="size-5 text-primary" />
              <span className="text-sm font-medium">Existing groups</span>
              <span className="text-xs text-muted-foreground">Label groups you already have.</span>
            </button>
          </div>
        )}

        {step === "new" && (
          <form className="flex flex-col gap-4" onSubmit={(event) => void submitNew(event)}>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit gap-1 text-muted-foreground"
              onClick={() => setStep("choose")}
            >
              <ArrowLeft data-icon="inline-start" className="size-3.5" /> Back
            </Button>
            <WhatsappGroupFields title={title} onTitleChange={setTitle} link={link} onLinkChange={setLink} />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="submit" disabled={pending || !title.trim() || !WHATSAPP_LINK_PATTERN.test(link.trim())}>
                {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
                Add group
              </Button>
            </DialogFooter>
          </form>
        )}

        {step === "existing" && (
          <div className="flex min-w-0 flex-col gap-4">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="-ml-2 w-fit gap-1 text-muted-foreground"
              onClick={() => (platform ? setPlatform(null) : setStep("choose"))}
            >
              <ArrowLeft data-icon="inline-start" className="size-3.5" /> Back
            </Button>

            {!platform ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPlatform("telegram")}
                  className="rounded-lg border border-border p-4 text-center text-sm font-medium hover:border-primary/50 hover:bg-accent"
                >
                  Telegram
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform("whatsapp")}
                  className="rounded-lg border border-border p-4 text-center text-sm font-medium hover:border-primary/50 hover:bg-accent"
                >
                  WhatsApp
                </button>
              </div>
            ) : (
              <div className="flex min-w-0 flex-col gap-2">
                <Input
                  placeholder={`Search ${platform === "telegram" ? "Telegram" : "WhatsApp"} groups…`}
                  value={groupQuery}
                  onChange={(event) => setGroupQuery(event.target.value)}
                  className="h-9"
                />
                {selectedExistingCount > 0 && (
                  <section
                    aria-label={`${selectedExistingCount} selected group${selectedExistingCount === 1 ? "" : "s"}`}
                    className="flex min-w-0 items-start gap-2 rounded-md border border-primary/20 bg-primary/5 p-2"
                  >
                    <span className="pt-0.5 text-xs font-medium whitespace-nowrap text-primary">
                      {selectedExistingCount} selected
                    </span>
                    <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                      {(platform === "telegram" ? selectedTgGroups : selectedWaGroups).map((group) => (
                        <button
                          key={"telegramId" in group ? group.telegramId : group.id}
                          type="button"
                          title={`Remove ${group.title}`}
                          onClick={() => ("telegramId" in group ? toggleTgGroup(group) : toggleWaGroup(group))}
                          className="flex max-w-full min-w-0 items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary hover:bg-primary/15"
                        >
                          <span className="truncate">{group.title}</span>
                          <X className="size-3 shrink-0" />
                        </button>
                      ))}
                    </div>
                  </section>
                )}
                <div className="h-56 min-w-0 overflow-y-auto rounded-md border border-border p-1">
                  {platform === "telegram" ? (
                    filteredTgGroups.length ? (
                      filteredTgGroups.map((group) => {
                        const checked = selectedTgGroups.some((g) => g.telegramId === group.telegramId)
                        return (
                          <button
                            key={group.telegramId}
                            type="button"
                            aria-pressed={checked}
                            onClick={() => toggleTgGroup(group)}
                            className={cn(
                              "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                              checked && "bg-primary/10 font-medium text-primary"
                            )}
                          >
                            <span className="truncate">{group.title}</span>
                            {checked && <Check className="ml-auto size-4 shrink-0" />}
                          </button>
                        )
                      })
                    ) : (
                      <p className="p-2 text-sm text-muted-foreground">No matching groups</p>
                    )
                  ) : filteredWaGroups.length ? (
                    filteredWaGroups.map((group) => {
                      const checked = selectedWaGroups.some((g) => g.id === group.id)
                      return (
                        <button
                          key={group.id}
                          type="button"
                          aria-pressed={checked}
                          onClick={() => toggleWaGroup(group)}
                          className={cn(
                            "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm hover:bg-accent",
                            checked && "bg-primary/10 font-medium text-primary"
                          )}
                        >
                          <span className="truncate">{group.title}</span>
                          {checked && <Check className="ml-auto size-4 shrink-0" />}
                        </button>
                      )
                    })
                  ) : (
                    <p className="p-2 text-sm text-muted-foreground">No matching groups</p>
                  )}
                </div>
              </div>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={closeDialog}>
                Cancel
              </Button>
              <Button type="button" disabled={pending || !canSubmitExisting} onClick={() => void submitExisting()}>
                {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
                {selectedExistingCount > 1 ? `Add ${selectedExistingCount} groups` : "Add group"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
