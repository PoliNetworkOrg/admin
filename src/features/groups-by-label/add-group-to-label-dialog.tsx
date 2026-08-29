import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ArrowLeft, LoaderCircle, Plus, Search } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { DEFAULT_GROUP_LABEL_COLOR } from "@/features/group-labels/group-labels.constants"
import { createGroupLabel } from "@/features/group-labels/group-labels.functions"
import { tagTelegramGroup } from "@/features/telegram/groups.functions"
import { createWhatsappGroup, setWhatsappGroupLabels } from "@/features/whatsapp/groups.functions"
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
  const setWhatsappGroupLabelsFn = useServerFn(setWhatsappGroupLabels)
  const tagTelegramGroupFn = useServerFn(tagTelegramGroup)

  const [open, setOpen] = useState(false)
  const [step, setStep] = useState<Step>("choose")
  const [platform, setPlatform] = useState<Platform | null>(null)
  const [selectedTgGroup, setSelectedTgGroup] = useState<TgGroup | null>(null)
  const [selectedWaGroup, setSelectedWaGroup] = useState<WaGroup | null>(null)
  const [title, setTitle] = useState("")
  const [tag, setTag] = useState("")
  const [link, setLink] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  const availableTgGroups = tgGroups.filter(
    (g) => !(tgLabelsByGroupId.get(g.telegramId) ?? []).some((l) => l.label === path)
  )
  const availableWaGroups = waGroups.filter((g) => !(waLabelsByGroupId.get(g.id) ?? []).some((l) => l.label === path))

  function reset() {
    setStep("choose")
    setPlatform(null)
    setSelectedTgGroup(null)
    setSelectedWaGroup(null)
    setTitle("")
    setTag("")
    setLink("")
    setError("")
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
      const created = await createWhatsappGroupFn({
        data: { title: title.trim(), tag: tag.trim() || undefined, link: link.trim() },
      })
      await setWhatsappGroupLabelsFn({ data: { groupId: created.id, labels: [path] } })
      toast.success(`${title.trim()} added and labeled "${path}".`)
      setOpen(false)
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The group could not be created. Check the details and try again."))
    } finally {
      setPending(false)
    }
  }

  async function submitExisting() {
    if (pending) return
    setPending(true)
    setError("")
    try {
      await ensureLabelExists()
      if (platform === "telegram" && selectedTgGroup) {
        await tagTelegramGroupFn({ data: { groupId: selectedTgGroup.telegramId, label: path } })
        toast.success(`${selectedTgGroup.title} labeled "${path}".`)
      } else if (platform === "whatsapp" && selectedWaGroup) {
        const currentLabels = waLabelsByGroupId.get(selectedWaGroup.id) ?? []
        await setWhatsappGroupLabelsFn({
          data: { groupId: selectedWaGroup.id, labels: [...currentLabels.map((l) => l.label), path] },
        })
        toast.success(`${selectedWaGroup.title} labeled "${path}".`)
      } else {
        return
      }
      setOpen(false)
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The group could not be labeled. Check your permissions and try again."))
    } finally {
      setPending(false)
    }
  }

  const canSubmitExisting = (platform === "telegram" && selectedTgGroup) || (platform === "whatsapp" && selectedWaGroup)

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        setOpen(nextOpen)
        if (!nextOpen) reset()
      }}
    >
      <DialogTrigger render={<Button />}>
        <Plus data-icon="inline-start" /> Add group
      </DialogTrigger>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add group to "{path}"</DialogTitle>
          <DialogDescription>
            {step === "choose" && "Create a brand new group, or categorize a group that already exists."}
            {step === "new" && "There's no bot managing WhatsApp groups yet, so this is just a manual record."}
            {step === "existing" && (platform ? "Pick the group to categorize." : "Which platform is the group on?")}
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
              <span className="text-sm font-medium">Existing group</span>
              <span className="text-xs text-muted-foreground">Label a group you already have.</span>
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
            <WhatsappGroupFields
              title={title}
              onTitleChange={setTitle}
              tag={tag}
              onTagChange={setTag}
              link={link}
              onLinkChange={setLink}
            />
            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
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
          <div className="flex flex-col gap-4">
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
                  className={cn(
                    "rounded-lg border border-border p-4 text-center text-sm font-medium hover:border-primary/50 hover:bg-accent"
                  )}
                >
                  Telegram
                </button>
                <button
                  type="button"
                  onClick={() => setPlatform("whatsapp")}
                  className={cn(
                    "rounded-lg border border-border p-4 text-center text-sm font-medium hover:border-primary/50 hover:bg-accent"
                  )}
                >
                  WhatsApp
                </button>
              </div>
            ) : platform === "telegram" ? (
              <Combobox
                items={availableTgGroups}
                value={selectedTgGroup}
                onValueChange={setSelectedTgGroup}
                itemToStringLabel={(group) => group.title}
                itemToStringValue={(group) => String(group.telegramId)}
                disabled={!availableTgGroups.length}
              >
                <ComboboxInput placeholder="Search Telegram groups…" className="h-10 text-sm" />
                <ComboboxContent>
                  <ComboboxEmpty>No matching groups</ComboboxEmpty>
                  <ComboboxList>
                    {(group) => (
                      <ComboboxItem key={group.telegramId} value={group}>
                        {group.title}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            ) : (
              <Combobox
                items={availableWaGroups}
                value={selectedWaGroup}
                onValueChange={setSelectedWaGroup}
                itemToStringLabel={(group) => group.title}
                itemToStringValue={(group) => String(group.id)}
                disabled={!availableWaGroups.length}
              >
                <ComboboxInput placeholder="Search WhatsApp groups…" className="h-10 text-sm" />
                <ComboboxContent>
                  <ComboboxEmpty>No matching groups</ComboboxEmpty>
                  <ComboboxList>
                    {(group) => (
                      <ComboboxItem key={group.id} value={group}>
                        {group.title}
                      </ComboboxItem>
                    )}
                  </ComboboxList>
                </ComboboxContent>
              </Combobox>
            )}

            {error && <p className="text-sm text-destructive">{error}</p>}
            <DialogFooter>
              <Button type="button" variant="outline" disabled={pending} onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="button" disabled={pending || !canSubmitExisting} onClick={() => void submitExisting()}>
                {pending && <LoaderCircle data-icon="inline-start" className="animate-spin-slow" />}
                Add category
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
