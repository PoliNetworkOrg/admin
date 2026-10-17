import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { Megaphone } from "lucide-react"
import { useState } from "react"

import { buttonMotion, ConfirmDialog, labelDisplayName } from "@/components/primitives"
import { appToast } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { untagGroup } from "@/features/group-labels/group-labels.functions"
import { isReleaseLabel } from "@/features/group-labels/label-tree"
import { setGroupVisibility } from "@/features/telegram/groups.functions"
import { setWhatsappGroupVisibility } from "@/features/whatsapp/groups.functions"
import type { GroupWithLabels } from "@/lib/api/types"
import { pluralize } from "@/lib/format"

type PublishTagGroupsDialogProps = {
  /** A `release-` label. */
  tag: string
  /** Every group tagged with it (not the search-filtered subset: publishing acts on the whole batch). */
  rows: GroupWithLabels[]
}

/**
 * Header-bar trigger "Publish {n} groups" (hidden while the batch is empty) plus the primary-tone confirmation.
 * Only publication labels are consumed; categories and attributes are never touched. The copy is frozen at open,
 * so the dialog closes cleanly once publishing empties the batch.
 */
export function PublishTagGroupsDialog({ tag, rows }: PublishTagGroupsDialogProps) {
  const router = useRouter()
  const setGroupVisibilityFn = useServerFn(setGroupVisibility)
  const setWaGroupVisibilityFn = useServerFn(setWhatsappGroupVisibility)
  const untagGroupFn = useServerFn(untagGroup)
  const tagName = labelDisplayName(tag)
  const [open, setOpen] = useState(false)
  const [batch, setBatch] = useState<GroupWithLabels[]>([])

  if (!isReleaseLabel(tag)) return null

  const groups = pluralize(batch.length, "group")
  const hidden = batch.filter((row) => row.hide).length
  const state =
    hidden > 0
      ? `${hidden} of the ${groups} tagged ${tagName} ${hidden === 1 ? "is" : "are"} still hidden and will become visible on the site.`
      : `All ${groups} tagged ${tagName} currently appear visible. Publishing makes them visible again before clearing the tag.`

  // Unhide first, then untag: if the untag fails the group is visible but still carries the tag, so it stays listed
  // here and a retry finishes the job. Already-visible rows are unhidden too: that is how a half-finished run is
  // cleaned up, and another tab may have hidden a group since the rows were loaded.
  async function publishOne(row: GroupWithLabels) {
    if (row.type === "tg") await setGroupVisibilityFn({ data: { telegramId: row.id, hide: false } })
    else await setWaGroupVisibilityFn({ data: { id: row.id, hide: false } })
    await untagGroupFn({ data: { groupId: row.id, type: row.type, label: tag } })
  }

  async function publish() {
    const results = await Promise.allSettled(batch.map(publishOne))
    const failed = results.filter((result) => result.status === "rejected").length
    await router.invalidate({ sync: true })
    if (failed > 0) {
      console.error(results)
      // A retry from the still-open dialog acts on the groups that are left.
      setBatch(batch.filter((_, index) => results[index]?.status === "rejected"))
      throw new Error(
        failed === batch.length
          ? "Couldn't publish the groups. Check your permissions and try again."
          : `${failed} of ${groups} couldn't be published; the rest were. They're still listed here, so you can try again.`
      )
    }
    appToast.success(`Published ${tagName}: ${groups} visible, tag cleared.`)
  }

  return (
    <>
      {rows.length > 0 && (
        <Button
          size="sm"
          className={buttonMotion}
          onClick={() => {
            setBatch(rows)
            setOpen(true)
          }}
        >
          <Megaphone aria-hidden data-icon="inline-start" />
          Publish {pluralize(rows.length, "group")}
        </Button>
      )}
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        tone="primary"
        title={`Publish ${tagName}?`}
        description={`${state} The ${tagName} tag is then removed from all of them. Their categories and attributes are left untouched.`}
        confirmLabel={`Publish ${groups}`}
        onConfirm={publish}
      />
    </>
  )
}
