import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { LoaderCircle, Megaphone } from "lucide-react"
import { useState } from "react"
import { toast } from "sonner"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import { untagGroup } from "@/features/group-labels/group-labels.functions"
import { formatLabelSegment } from "@/features/group-labels/label-tree"
import type { CombinedGroupRow } from "@/features/groups-by-label/combined-groups-table"
import { setGroupVisibility } from "@/features/telegram/groups.functions"
import { setWhatsappGroupVisibility } from "@/features/whatsapp/groups.functions"
import { errorMessage } from "@/lib/errors"

/**
 * Releases a batch: every group carrying this flat tag becomes visible and then loses the tag. Only ever offered
 * for a flat tag, never a category — a tag is a throwaway grouping, so clearing it is the intended cleanup,
 * while a category is the group's real place on the site and must survive.
 */
export function PublishTagGroupsDialog({ tag, rows }: { tag: string; rows: CombinedGroupRow[] }) {
  const router = useRouter()
  const setGroupVisibilityFn = useServerFn(setGroupVisibility)
  const setWaGroupVisibilityFn = useServerFn(setWhatsappGroupVisibility)
  const untagGroupFn = useServerFn(untagGroup)
  const [open, setOpen] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  if (!rows.length) return null

  const tagName = formatLabelSegment(tag)
  const hiddenCount = rows.filter((row) => row.group.hide).length

  async function publishOne(row: CombinedGroupRow) {
    // Unhide first, then untag: if the untag fails the group is visible but still carries the tag, so it stays
    // listed on this page and a retry finishes the job. The reverse order would clear the tag and leave no handle
    // on a group that is still hidden. Already-visible rows are included for the same reason — they are how a
    // half-finished run gets cleaned up.
    if (row.platform === "telegram") {
      if (row.group.hide) await setGroupVisibilityFn({ data: { telegramId: row.group.telegramId, hide: false } })
      await untagGroupFn({ data: { groupId: row.group.telegramId, type: "tg", label: tag } })
    } else {
      if (row.group.hide) await setWaGroupVisibilityFn({ data: { id: row.group.id, hide: false } })
      await untagGroupFn({ data: { groupId: row.group.id, type: "wa", label: tag } })
    }
  }

  async function publish() {
    if (pending) return
    setPending(true)
    setError("")
    try {
      const results = await Promise.allSettled(rows.map((row) => publishOne(row)))
      const failed = results.filter((result) => result.status === "rejected").length
      if (failed > 0) {
        // A row's unhide may have succeeded even if its untag (or another row entirely) failed — refresh so the
        // underlying data reflects what's actually saved, instead of silently implying nothing happened.
        await router.invalidate({ sync: true })
        setError(
          failed === rows.length
            ? "The groups could not be published. Check your permissions and try again."
            : `${failed} of ${rows.length} group(s) couldn't be published — the rest were. They're still listed here, so you can try again.`
        )
        return
      }
      toast.success(
        `Published "${tagName}" — ${rows.length} group${rows.length === 1 ? "" : "s"} visible, tag cleared.`
      )
      setOpen(false)
      await router.invalidate({ sync: true })
    } catch (cause) {
      console.error(cause)
      setError(errorMessage(cause, "The groups could not be published. Check your permissions and try again."))
    } finally {
      setPending(false)
    }
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (pending) return
        setOpen(nextOpen)
        if (!nextOpen) setError("")
      }}
    >
      <AlertDialogTrigger render={<Button variant="outline" className="gap-1.5" />}>
        <Megaphone data-icon="inline-start" />
        Publish {rows.length} group{rows.length === 1 ? "" : "s"} ({hiddenCount || "none"} hidden)
      </AlertDialogTrigger>
      <AlertDialogContent size="sm">
        <AlertDialogHeader>
          <AlertDialogTitle>Publish "{tagName}"?</AlertDialogTitle>
          <AlertDialogDescription>
            {hiddenCount > 0
              ? `${hiddenCount} of the ${rows.length} group(s) tagged "${tagName}" are still hidden and will become visible on the site.`
              : `None of the ${rows.length} group(s) tagged "${tagName}" are hidden, so this only clears the tag.`}{" "}
            The "{tagName}" tag is then removed from all of them. Their categories are left untouched.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={pending} onClick={() => void publish()}>
            {pending && <LoaderCircle data-icon="inline-start" className="animate-spin" />} Confirm publish
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
