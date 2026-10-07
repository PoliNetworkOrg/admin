import { Link, useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { ChevronDown, ChevronRight, EllipsisVertical, Megaphone, Plus, Tag, Tags, Trash2 } from "lucide-react"
import { type CSSProperties, type ReactNode, useDeferredValue, useEffect, useMemo, useState } from "react"

import {
  buttonMotion,
  ColorSwatchSelect,
  ConfirmDialog,
  EmptyState,
  IconButton,
  InlineEditInput,
  InlineEditRow,
  LabelChip,
  LabelDot,
  labelDisplayName,
  labelKind,
  Menu,
  MenuContent,
  MenuItem,
  MenuTrigger,
  Reveal,
  RowActions,
  SectionHeading,
  Unset,
  useEditSlot,
} from "@/components/primitives"
import { appToast, Count, PageBar, PageContent, Toolbar, useCanWrite } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { AddChildLabelDialog } from "@/features/groups-by-label/add-child-label-dialog"
import { errorMessage } from "@/lib/errors"
import { cn } from "@/lib/utils"

import { AddCategoryDialog } from "./add-category-dialog"
import { AddTagDialog, type TagKind } from "./add-tag-dialog"
import { GROUP_LABEL_DESCRIPTION_MAX } from "./group-labels.constants"
import { deleteGroupLabel, editGroupLabel } from "./group-labels.functions"
import { groupLabelSaveErrorMessage } from "./group-labels.validation"
import {
  buildCategoryRootTree,
  CATEGORY_ROOTS,
  filterFlatLabels,
  filterLabelTree,
  formatLabelBreadcrumb,
  formatLabelSegment,
  isCategoryLabel,
  isReleaseLabel,
  labelPathToUrlSegments,
  type LabelTreeNode,
} from "./label-tree"
import { RenameLabelDialog } from "./rename-label-dialog"
import type { GroupLabel } from "./types"

const EXPANDED_KEY = "pn-admin:labels-expanded"

/**
 * Expanded category paths, persisted per tab as newline-separated paths. The roots start expanded; session storage
 * is read after mount so the server render and the first client render agree.
 */
function useExpandedPaths() {
  const [expanded, setExpanded] = useState(() => new Set(CATEGORY_ROOTS))

  useEffect(() => {
    const stored = window.sessionStorage.getItem(EXPANDED_KEY)
    if (stored !== null) setExpanded(new Set(stored.split("\n").filter(Boolean)))
  }, [])

  function commit(next: Set<string>) {
    window.sessionStorage.setItem(EXPANDED_KEY, [...next].join("\n"))
    setExpanded(next)
  }

  return {
    expanded,
    toggle(path: string) {
      const next = new Set(expanded)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      commit(next)
    },
    expand(path: string) {
      if (!expanded.has(path)) commit(new Set([...expanded, path]))
    },
    /** Carries expanded state over a cascading rename. */
    rename(from: string, to: string) {
      const moved = [...expanded].map((path) =>
        path === from || path.startsWith(`${from}.`) ? `${to}${path.slice(from.length)}` : path
      )
      commit(new Set(moved))
    },
  }
}

type Draft = { label: string; color: string; description: string }

const surface = "@container overflow-hidden rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-surface)"

export function GroupLabelsPage({ labels }: { labels: GroupLabel[] }) {
  const router = useRouter()
  const editGroupLabelFn = useServerFn(editGroupLabel)
  const deleteGroupLabelFn = useServerFn(deleteGroupLabel)
  const canWrite = useCanWrite("web")
  const [query, setQuery] = useState("")
  const deferredQuery = useDeferredValue(query)
  const searching = deferredQuery.trim() !== ""

  const categories = useMemo(() => labels.filter((label) => isCategoryLabel(label.label)), [labels])
  const attributes = useMemo(
    () => labels.filter((label) => !isCategoryLabel(label.label) && !isReleaseLabel(label.label)),
    [labels]
  )
  const publications = useMemo(() => labels.filter((label) => isReleaseLabel(label.label)), [labels])
  const tree = useMemo(() => buildCategoryRootTree(categories), [categories])
  const visibleTree = useMemo(() => filterLabelTree(tree, deferredQuery), [tree, deferredQuery])
  const visibleAttributes = filterFlatLabels(attributes, deferredQuery)
  const visiblePublications = filterFlatLabels(publications, deferredQuery)
  const matchingCategories = filterFlatLabels(categories, deferredQuery).length
  const visibleCount = matchingCategories + visibleAttributes.length + visiblePublications.length

  const expansion = useExpandedPaths()
  const [saving, setSaving] = useState(false)
  const slot = useEditSlot<string>("label", saving)
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const editing = labels.find((label) => label.label === slot.editingId) ?? null
  if (!editing && draft !== null) {
    setDraft(null)
  } else if (editing && draft?.label !== editing.label) {
    setDraft({ label: editing.label, color: editing.color, description: editing.description ?? "" })
  }
  const dirty =
    editing !== null &&
    draft !== null &&
    (draft.color !== editing.color || draft.description.trim() !== (editing.description ?? ""))

  const [addCategoryOpen, setAddCategoryOpen] = useState(false)
  const [tagDialog, setTagDialog] = useState<{ open: boolean; kind: TagKind }>({ open: false, kind: "attribute" })
  const [renameDialog, setRenameDialog] = useState({ open: false, path: "" })
  const [childDialog, setChildDialog] = useState({ open: false, path: "" })
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; label: GroupLabel | null }>({
    open: false,
    label: null,
  })

  function startEdit(label: string) {
    setSaveError(null)
    slot.start(label, dirty)
  }

  async function saveEdit() {
    if (!editing || !draft) return
    setSaving(true)
    setSaveError(null)
    try {
      await editGroupLabelFn({
        data: { label: editing.label, color: draft.color, description: draft.description.trim() },
      })
      await router.invalidate({ sync: true })
      appToast.success("Label updated.")
      slot.stop()
    } catch (cause) {
      console.error(cause)
      setSaveError(groupLabelSaveErrorMessage(cause))
    } finally {
      setSaving(false)
    }
  }

  async function deleteLabel(label: GroupLabel) {
    try {
      await deleteGroupLabelFn({ data: { label: label.label } })
    } catch (cause) {
      console.error(cause)
      throw new Error(errorMessage(cause, "Couldn't delete the label. Check your permissions and try again."))
    }
    await router.invalidate({ sync: true })
    if (slot.editingId === label.label) slot.stop()
    appToast.success("Label deleted.")
  }

  const openTagDialog = (kind: TagKind) => setTagDialog({ open: true, kind })

  const row: RowContext = {
    canWrite,
    searching,
    expanded: expansion.expanded,
    onToggle: (path) => expansion.toggle(path),
    editingId: slot.editingId,
    draft,
    setDraft,
    dirty,
    saving,
    saveError,
    onEdit: startEdit,
    onCancel: () => {
      setSaveError(null)
      slot.stop()
    },
    onSave: () => void saveEdit(),
    onRename: (path) => setRenameDialog({ open: true, path }),
    onAddChild: (path) => setChildDialog({ open: true, path }),
    onDelete: (label) => setDeleteDialog({ open: true, label }),
  }

  const clearSearch = (
    <Button variant="ghost" size="sm" onClick={() => setQuery("")} className={buttonMotion}>
      Clear search
    </Button>
  )

  const tagEmpty = (kind: TagKind, title: string, text: string) =>
    searching ? (
      <EmptyState
        icon={Tags}
        title={`No ${kind}s match`}
        text="Try a different name or description."
        action={clearSearch}
      />
    ) : (
      <EmptyState
        icon={Tags}
        title={title}
        text={text}
        action={
          canWrite && (
            <Button variant="outline" size="sm" onClick={() => openTagDialog(kind)} className={buttonMotion}>
              {kind === "attribute" ? (
                <Plus aria-hidden data-icon="inline-start" />
              ) : (
                <Megaphone aria-hidden data-icon="inline-start" />
              )}
              {kind === "attribute" ? "Add attribute" : "Create publication"}
            </Button>
          )
        }
      />
    )

  return (
    <>
      <PageBar
        width="tree"
        left={
          <Toolbar
            // Wider than the 280px default so the long placeholder is readable.
            search={{ value: query, onChange: setQuery, className: "xl:w-[360px]" }}
            count={
              searching ? (
                <Count value={visibleCount} total={labels.length} noun="label" />
              ) : (
                <Count value={labels.length} noun="label" />
              )
            }
          />
        }
        right={
          canWrite ? (
            <>
              <Menu>
                <MenuTrigger render={<Button variant="outline" size="sm" className={buttonMotion} />}>
                  <Plus aria-hidden data-icon="inline-start" />
                  Add tag
                  <ChevronDown aria-hidden data-icon="inline-end" className="text-(--pn-fg-muted)" />
                </MenuTrigger>
                <MenuContent>
                  <MenuItem onClick={() => openTagDialog("attribute")}>
                    <Tag aria-hidden />
                    Add attribute
                  </MenuItem>
                  <MenuItem onClick={() => openTagDialog("publication")}>
                    <Megaphone aria-hidden />
                    Create publication
                  </MenuItem>
                </MenuContent>
              </Menu>
              <Button size="sm" onClick={() => setAddCategoryOpen(true)} className={buttonMotion}>
                <Plus aria-hidden data-icon="inline-start" />
                Add category
              </Button>
            </>
          ) : null
        }
      />
      <PageContent width="tree">
        <div className="flex flex-col gap-8">
          <section className="flex flex-col gap-3" aria-labelledby="labels-categories">
            <SectionHeading
              id="labels-categories"
              title="Categories"
              count={matchingCategories}
              description="A browsable hierarchy: drill down from Didattica or Extra to organize groups by course, year, or type."
            />
            <div className={surface}>
              {visibleTree.length > 0 ? (
                <div className="-mb-px">
                  {visibleTree.map((node) => (
                    <CategoryNode key={node.path} node={node} depth={0} ctx={row} />
                  ))}
                </div>
              ) : (
                <EmptyState
                  icon={Tags}
                  title="No categories match"
                  text="Try a different name or description."
                  action={clearSearch}
                />
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="labels-attributes">
            <SectionHeading
              id="labels-attributes"
              title="Attributes"
              count={visibleAttributes.length}
              description="Permanent tags, like a language or campus. They are preserved when groups are published."
            />
            <div className={surface}>
              {visibleAttributes.length > 0 ? (
                <div className="-mb-px">
                  {visibleAttributes.map((label) => (
                    <LabelRow key={label.label} label={label} depth={0} ctx={row} />
                  ))}
                </div>
              ) : (
                tagEmpty("attribute", "No attributes yet", "Add the first attribute, like a language or campus.")
              )}
            </div>
          </section>

          <section className="flex flex-col gap-3" aria-labelledby="labels-publications">
            <SectionHeading
              id="labels-publications"
              title="Publications"
              count={visiblePublications.length}
              description="Temporary batches of groups to publish together. Only their release labels are cleared."
              action={
                canWrite && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => openTagDialog("publication")}
                    className={buttonMotion}
                  >
                    <Megaphone aria-hidden data-icon="inline-start" />
                    Create publication
                  </Button>
                )
              }
            />
            <div className={surface}>
              {visiblePublications.length > 0 ? (
                <div className="-mb-px">
                  {visiblePublications.map((label) => (
                    <LabelRow key={label.label} label={label} depth={0} ctx={row} />
                  ))}
                </div>
              ) : (
                tagEmpty(
                  "publication",
                  "No publications yet",
                  "Create a publication, add existing groups, then publish the batch."
                )
              )}
            </div>
          </section>
        </div>
      </PageContent>

      {slot.discardDialog}
      <AddCategoryDialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen} labels={labels} />
      <AddTagDialog
        open={tagDialog.open}
        kind={tagDialog.kind}
        onOpenChange={(open) => setTagDialog((current) => ({ ...current, open }))}
      />
      <RenameLabelDialog
        open={renameDialog.open}
        path={renameDialog.path}
        labels={labels}
        onOpenChange={(open) => setRenameDialog((current) => ({ ...current, open }))}
        onRenamed={(newPath) => expansion.rename(renameDialog.path, newPath)}
      />
      <AddChildLabelDialog
        open={childDialog.open}
        path={childDialog.path}
        onOpenChange={(open) => setChildDialog((current) => ({ ...current, open }))}
        onCreated={() => expansion.expand(childDialog.path)}
      />
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((current) => ({ ...current, open }))}
        title="Delete label?"
        description={`${formatLabelBreadcrumb(deleteDialog.label?.label ?? "")} is removed from every group that uses it. This cannot be undone.`}
        confirmLabel="Delete label"
        onConfirm={async () => {
          if (deleteDialog.label) await deleteLabel(deleteDialog.label)
        }}
      />
    </>
  )
}

type RowContext = {
  canWrite: boolean
  searching: boolean
  expanded: Set<string>
  onToggle: (path: string) => void
  editingId: string | null
  draft: Draft | null
  setDraft: (draft: Draft) => void
  dirty: boolean
  saving: boolean
  saveError: string | null
  onEdit: (label: string) => void
  onCancel: () => void
  onSave: () => void
  onRename: (path: string) => void
  onAddChild: (path: string) => void
  onDelete: (label: GroupLabel) => void
}

function CategoryNode({ node, depth, ctx }: { node: LabelTreeNode; depth: number; ctx: RowContext }) {
  const hasChildren = node.children.length > 0
  const open = hasChildren && (ctx.searching || ctx.expanded.has(node.path))
  const name = formatLabelSegment(node.segment)
  const childrenId = `label-children-${node.path}`

  const chevron = (
    <button
      type="button"
      aria-label={`${open ? "Collapse" : "Expand"} ${name}`}
      aria-expanded={hasChildren ? open : undefined}
      aria-controls={hasChildren ? childrenId : undefined}
      disabled={ctx.searching}
      onClick={() => ctx.onToggle(node.path)}
      className={cn(
        "-ml-1.5 flex size-7 shrink-0 items-center justify-center rounded-(--pn-r-2) text-(--pn-fg-muted) transition-[background-color,color] duration-120 hover:bg-(--pn-muted) hover:text-(--pn-fg) disabled:hover:bg-transparent",
        !hasChildren && "invisible"
      )}
    >
      <ChevronRight
        aria-hidden
        className={cn("size-4 transition-transform duration-150 ease-(--pn-ease-out)", open && "rotate-90")}
      />
    </button>
  )

  // The two fixed roots can't be renamed: the whole tree keys off their exact name.
  const isRoot = depth === 0
  const menu = ctx.canWrite ? (
    <Menu>
      <MenuTrigger
        render={<IconButton label="More actions" ariaLabel={`More actions for ${name}`} icon={EllipsisVertical} />}
      />
      <MenuContent>
        {!isRoot && <MenuItem onClick={() => ctx.onRename(node.path)}>Rename</MenuItem>}
        <MenuItem onClick={() => ctx.onAddChild(node.path)}>Add sub-category</MenuItem>
        {node.label && <MobileLabelActions label={node.label} ctx={ctx} />}
      </MenuContent>
    </Menu>
  ) : null

  return (
    <div>
      {node.label ? (
        <LabelRow label={node.label} depth={depth} ctx={ctx} chevron={chevron} menu={menu} />
      ) : (
        <PlainRow
          depth={depth}
          lead={chevron}
          name={
            <>
              {/* Grouping nodes have no dot; the spacer keeps sibling names aligned. */}
              <span aria-hidden className="size-2 shrink-0" />
              <NameLink path={node.path} name={name} />
            </>
          }
          description={null}
          actions={
            ctx.canWrite && (
              <RowActions className="shrink-0">
                {/* Reserve Edit/Delete slots so ⋮ stays aligned at the far right. */}
                <span aria-hidden className="size-9" />
                <span aria-hidden className="ml-2 size-9" />
                {menu}
              </RowActions>
            )
          }
        />
      )}
      {hasChildren && (
        <Reveal open={open}>
          <div id={childrenId}>
            {node.children.map((child) => (
              <CategoryNode key={child.path} node={child} depth={depth + 1} ctx={ctx} />
            ))}
          </div>
        </Reveal>
      )}
    </div>
  )
}

const rowClasses = "border-b border-(--pn-line)"
const mobileRowClasses =
  "max-sm:gap-2 max-sm:px-3 max-sm:[&>div:last-child>span]:hidden max-sm:[&>div:last-child>button:not([aria-haspopup=menu])]:hidden"
const nameLinkClasses =
  "min-w-0 truncate text-[13px] leading-5 font-medium text-(--pn-fg) underline-offset-2 hover:underline"

/** Categories link to their browser page, tags to their tag page. */
function NameLink({ path, name }: { path: string; name: string }) {
  const title = labelDisplayName(path)
  if (isCategoryLabel(path)) {
    return (
      <Link
        to="/dashboard/web/groups-by-label/$"
        params={{ _splat: labelPathToUrlSegments(path).join("/") }}
        title={title}
        className={nameLinkClasses}
      >
        {name}
      </Link>
    )
  }
  return (
    <Link to="/dashboard/web/tags/$tag" params={{ tag: path }} title={title} className={nameLinkClasses}>
      {name}
    </Link>
  )
}

function Description({ text }: { text: string | null }) {
  return (
    <span
      title={text ?? undefined}
      className="hidden w-[42%] shrink-0 truncate text-[13px] leading-5 text-(--pn-fg-muted) @[560px]:block"
    >
      {text || <Unset />}
    </span>
  )
}

function Indent({ depth }: { depth: number }) {
  const style: CSSProperties & Record<"--label-indent" | "--label-mobile-indent", string> = {
    "--label-indent": `${depth * 24}px`,
    "--label-mobile-indent": `${Math.min(depth * 8, 32)}px`,
  }
  return depth > 0 ? (
    <span aria-hidden className="w-(--label-indent) shrink-0 max-sm:w-(--label-mobile-indent)" style={style} />
  ) : null
}

function MobileLabelActions({ label, ctx }: { label: GroupLabel; ctx: RowContext }) {
  return (
    <>
      <MenuItem className="sm:hidden" onClick={() => ctx.onEdit(label.label)}>
        Edit color and description
      </MenuItem>
      <MenuItem className="sm:hidden" variant="destructive" onClick={() => ctx.onDelete(label)}>
        Delete label
      </MenuItem>
    </>
  )
}

/** Grouping nodes (no label row) and read-only rows: same 44px geometry as `InlineEditRow`. */
function PlainRow({
  depth,
  lead,
  name,
  description,
  actions,
}: {
  depth: number
  lead?: ReactNode
  name: ReactNode
  description: string | null
  actions?: ReactNode
}) {
  return (
    <div className={cn("flex min-h-11 items-center gap-3 px-4", rowClasses, actions && mobileRowClasses)}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <Indent depth={depth} />
          {lead}
          {name}
        </span>
        <Description text={description} />
      </div>
      {actions}
    </div>
  )
}

function LabelRow({
  label,
  depth,
  ctx,
  chevron,
  menu,
}: {
  label: GroupLabel
  depth: number
  ctx: RowContext
  chevron?: ReactNode
  menu?: ReactNode
}) {
  const segment = label.label.split(".").at(-1) ?? label.label
  const name = labelKind(label.label) === "category" ? formatLabelSegment(segment) : labelDisplayName(label.label)
  const nameNode = (
    <>
      <LabelDot color={label.color} />
      <NameLink path={label.label} name={name} />
    </>
  )

  if (!ctx.canWrite) {
    return <PlainRow depth={depth} lead={chevron} name={nameNode} description={label.description} />
  }

  const draft = ctx.editingId === label.label && ctx.draft?.label === label.label ? ctx.draft : null

  return (
    <InlineEditRow
      className={cn(
        rowClasses,
        draft === null ? mobileRowClasses : "max-sm:[&>div:first-child>div:last-child]:basis-full"
      )}
      editing={draft !== null}
      onEdit={() => ctx.onEdit(label.label)}
      onCancel={ctx.onCancel}
      onSave={ctx.onSave}
      dirty={ctx.dirty}
      valid
      saving={ctx.saving}
      error={ctx.saveError}
      editLabel="Edit label"
      editAriaLabel={`Edit color and description for ${name}`}
      actions={
        menu ??
        (!isCategoryLabel(label.label) ? (
          <Menu>
            <MenuTrigger
              render={
                <IconButton
                  label="More actions"
                  ariaLabel={`More actions for ${name}`}
                  icon={EllipsisVertical}
                  className={isReleaseLabel(label.label) ? "sm:hidden" : undefined}
                />
              }
            />
            <MenuContent>
              {!isReleaseLabel(label.label) && <MenuItem onClick={() => ctx.onRename(label.label)}>Rename</MenuItem>}
              <MobileLabelActions label={label} ctx={ctx} />
            </MenuContent>
          </Menu>
        ) : null)
      }
      deleteAction={
        <IconButton
          label="Delete label"
          ariaLabel={`Delete ${name}`}
          icon={Trash2}
          tone="danger"
          onClick={() => ctx.onDelete(label)}
        />
      }
      view={
        <>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <Indent depth={depth} />
            {chevron}
            {nameNode}
          </span>
          <Description text={label.description} />
        </>
      }
      edit={
        draft && (
          <>
            <Indent depth={depth} />
            <ColorSwatchSelect value={draft.color} onChange={(color) => ctx.setDraft({ ...draft, color })} />
            <LabelChip label={{ ...label, color: draft.color }} className="shrink-0" />
            <InlineEditInput
              label={`Description for ${name}`}
              value={draft.description}
              onChange={(event) => ctx.setDraft({ ...draft, description: event.target.value })}
              placeholder="What kind of groups does this label apply to?"
              maxLength={GROUP_LABEL_DESCRIPTION_MAX}
              autoFocus
              className="min-w-56 max-sm:min-w-0"
            />
          </>
        )
      }
    />
  )
}
