import { useSortable } from "@dnd-kit/react/sortable"
import { ExternalLink, GripVertical, MoreVertical, Trash2 } from "lucide-react"
import { useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import {
  ConfirmDialog,
  IconButton,
  InlineEditCard,
  InlineEditInput,
  InlineEditTextarea,
  Menu,
  MenuContent,
  MenuGroup,
  MenuLabel,
  MenuRadioGroup,
  MenuRadioItem,
  MenuTrigger,
  StatusBadge,
  Unset,
} from "@/components/primitives"
import { hostOf } from "@/lib/format"
import { cn } from "@/lib/utils"

import { WebLogo, WebLogoUpload } from "../web/logo-upload"
import { focusOnFinePointer, LanguageChip, LanguageTerm } from "../web/web-card"
import {
  isProjectCategory,
  PROJECT_CATEGORIES,
  PROJECT_DESCRIPTION_MAX_LENGTH,
  PROJECT_LINK_MAX_LENGTH,
  PROJECT_LOGO_RULES,
  PROJECT_TITLE_MAX_LENGTH,
} from "./projects.constants"
import type { Project, ProjectCategory, ProjectForm } from "./types"

/** The open inline edit, owned by the page so only one card edits at a time. */
export type ProjectEditSession = {
  values: ProjectForm
  onChange: (values: ProjectForm) => void
  dirty: boolean
  valid: boolean
  saving: boolean
  error?: string
  /** Logo validation message, shown in the card footer. */
  message?: string
  /** Shown under the link field. */
  linkError?: string
  onSave: () => void
  onCancel: () => void
  onLinkBlur: () => void
  onLogoError: (message: string | null) => void
}

type ProjectCardProps = {
  project: Project
  /** Position within the active category, for sorting. */
  index: number
  draft?: boolean
  canWrite: boolean
  session: ProjectEditSession | null
  onEdit: () => void
  /** Toasts its own outcome; never throws. */
  onMove: (category: ProjectCategory) => Promise<void>
  /** Throws to keep the confirm dialog open with the error. */
  onDelete: () => Promise<void>
}

const SORT_TRANSITION = { duration: 160, easing: "cubic-bezier(0.45, 0, 0.2, 1)", idle: false }

export function ProjectCard({
  project,
  index,
  draft = false,
  canWrite,
  session,
  onEdit,
  onMove,
  onDelete,
}: ProjectCardProps) {
  const reduceMotion = useReducedMotion()
  const editing = session !== null
  const { ref, handleRef, isDragging, isDropping } = useSortable({
    id: project.id,
    index,
    group: project.category,
    disabled: draft || editing || !canWrite,
    transition: reduceMotion ? null : SORT_TRANSITION,
  })
  const [moving, setMoving] = useState(false)
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) focusOnFinePointer(titleRef.current)
  }, [editing])

  async function move(category: ProjectCategory) {
    setMoving(true)
    await onMove(category)
    setMoving(false)
  }

  const handle = (
    <button
      ref={handleRef}
      type="button"
      aria-label={`Reorder ${project.title}`}
      className="absolute top-4 left-0 grid h-10 w-4 cursor-grab touch-none place-items-center rounded-(--pn-r-1) text-(--pn-fg-subtle) transition-[color] duration-120 group-hover/card:text-(--pn-fg-muted) after:absolute after:inset-y-0 after:left-0 after:w-9 active:cursor-grabbing"
    >
      <GripVertical aria-hidden className="size-4" />
    </button>
  )

  const view = (
    <>
      <div className="flex h-10 min-w-0 items-center gap-3">
        <WebLogo src={project.logo} name={project.title} fallback="PR" />
        <p title={project.title} className="truncate text-sm leading-5 font-medium text-(--pn-fg)">
          {project.title}
        </p>
      </div>
      <p className="text-[13px] leading-5">
        {project.link ? (
          <a
            href={project.link}
            target="_blank"
            rel="noreferrer"
            title={project.link}
            className="inline-flex max-w-full items-center gap-1 text-(--pn-accent) transition-[color] duration-120 hover:text-(--pn-accent-hover) hover:underline"
          >
            <span className="truncate">{hostOf(project.link)}</span>
            <ExternalLink aria-hidden className="size-3 shrink-0" />
          </a>
        ) : (
          <Unset />
        )}
      </p>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3">
        <LanguageTerm code="IT" name="Italian" />
        <dd lang="it" className="line-clamp-4 text-[13px] leading-5 text-pretty whitespace-pre-line text-(--pn-fg)">
          {project.descriptionIt}
        </dd>
        <LanguageTerm code="EN" name="English" />
        <dd lang="en" className="line-clamp-4 text-[13px] leading-5 text-pretty whitespace-pre-line text-(--pn-fg)">
          {project.descriptionEn}
        </dd>
      </dl>
    </>
  )

  const edit = session && (
    <>
      <div className="flex h-10 min-w-0 items-center gap-3">
        <WebLogoUpload
          src={session.values.logo}
          name={session.values.title}
          fallback="PR"
          rules={PROJECT_LOGO_RULES}
          disabled={session.saving}
          onChange={({ file, preview }) => session.onChange({ ...session.values, logo: preview, logoFile: file })}
          onError={session.onLogoError}
        />
        <InlineEditInput
          ref={titleRef}
          label="Project title"
          placeholder="Project title"
          value={session.values.title}
          maxLength={PROJECT_TITLE_MAX_LENGTH}
          onChange={(event) => session.onChange({ ...session.values, title: event.target.value })}
        />
        {draft && <StatusBadge tone="warning">Draft</StatusBadge>}
      </div>
      <InlineEditInput
        label="Project link"
        type="url"
        inputMode="url"
        placeholder="https://…"
        value={session.values.link}
        maxLength={PROJECT_LINK_MAX_LENGTH}
        onChange={(event) => session.onChange({ ...session.values, link: event.target.value })}
        onBlur={session.onLinkBlur}
        error={session.linkError}
      />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3">
        <LanguageChip code="IT" className="mt-2.5" />
        <InlineEditTextarea
          label="Italian description"
          lang="it"
          placeholder="Descrizione in italiano"
          value={session.values.descriptionIt}
          maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => session.onChange({ ...session.values, descriptionIt: event.target.value })}
        />
        <LanguageChip code="EN" className="mt-2.5" />
        <InlineEditTextarea
          label="English description"
          lang="en"
          placeholder="Description in English"
          value={session.values.descriptionEn}
          maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => session.onChange({ ...session.values, descriptionEn: event.target.value })}
        />
      </div>
    </>
  )

  const moveMenu = (
    <Menu>
      <MenuTrigger
        render={
          <IconButton label="Move project" ariaLabel={`Move ${project.title}`} icon={MoreVertical} pending={moving} />
        }
      />
      <MenuContent className="w-48">
        <MenuGroup>
          <MenuLabel>Move to</MenuLabel>
          <MenuRadioGroup
            value={project.category}
            onValueChange={(value: string) => {
              if (isProjectCategory(value) && value !== project.category) void move(value)
            }}
          >
            {PROJECT_CATEGORIES.map((category) => (
              <MenuRadioItem key={category.value} value={category.value}>
                {category.label}
              </MenuRadioItem>
            ))}
          </MenuRadioGroup>
        </MenuGroup>
      </MenuContent>
    </Menu>
  )

  const deleteButton = (
    <ConfirmDialog
      title="Delete project?"
      description={`${project.title} is removed from the website. This cannot be undone.`}
      confirmLabel="Delete project"
      onConfirm={onDelete}
      trigger={<IconButton label="Delete project" ariaLabel={`Delete ${project.title}`} icon={Trash2} tone="danger" />}
    />
  )

  return (
    <div
      ref={ref}
      className={cn(
        "group/card rounded-(--pn-r-4)",
        (isDragging || isDropping) && "z-10 scale-[1.01] opacity-90 shadow-(--pn-shadow-float)"
      )}
    >
      <InlineEditCard
        className="relative"
        readOnly={!canWrite}
        editing={editing}
        onEdit={onEdit}
        onCancel={session?.onCancel ?? noop}
        onSave={session?.onSave ?? noop}
        dirty={session?.dirty ?? false}
        valid={session?.valid ?? false}
        saving={session?.saving ?? false}
        error={session?.error}
        message={session?.message}
        editLabel="Edit project"
        editAriaLabel={`Edit ${project.title}`}
        handle={handle}
        actions={moveMenu}
        deleteAction={deleteButton}
        view={view}
        edit={edit}
      />
    </div>
  )
}

function noop() {}
