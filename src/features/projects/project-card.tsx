import { useSortable } from "@dnd-kit/react/sortable"
import { ExternalLink, FolderInput, GripVertical, Trash2 } from "lucide-react"
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
  TranslationGroup,
  TranslationPanel,
  TranslationText,
  Unset,
} from "@/components/primitives"
import { Hint } from "@/components/primitives/hint"
import { cn } from "@/lib/utils"

import { WebLogo, WebLogoUpload } from "../web/logo-upload"
import { focusOnFinePointer } from "../web/web-card"
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
  // A move writes the whole record with its old values, so edit, delete and drag wait for it to finish.
  const [moving, setMoving] = useState(false)
  // Layout follows `draggable`, so a pending move (which pauses sorting) doesn't shift the card's content.
  const draggable = canWrite && !draft && !editing
  const sortable = draggable && !moving
  // The whole card is the drag source: a pointer drags it after 5px (buttons and links still click), touch after a
  // 250ms press, and the keyboard picks it up with Space/Enter while the card itself has focus.
  const { ref, isDragging, isDropping } = useSortable({
    id: project.id,
    index,
    group: project.category,
    disabled: !sortable,
    transition: reduceMotion ? null : SORT_TRANSITION,
  })
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
    <GripVertical
      aria-hidden
      className="absolute top-1/2 left-2 size-4 -translate-y-1/2 text-(--pn-fg-subtle) transition-[color] duration-120 group-hover/project:text-(--pn-fg-muted) max-shell:hidden"
    />
  )

  const viewHeader = (
    <div className="flex min-w-0 items-center gap-3.5">
      <WebLogo src={project.logo} name={project.title} fallback="PR" className="size-12 rounded-(--pn-r-4)" />
      <div className="flex min-w-0 flex-col">
        <Hint overflowOnly label={project.title}>
          <h3 className="truncate text-[16px] leading-6 font-semibold text-(--pn-fg)">{project.title}</h3>
        </Hint>
        {project.link ? (
          <Hint label={project.link}>
            <a
              href={project.link}
              target="_blank"
              rel="noreferrer"

              className="inline-flex max-w-full items-center gap-1 text-[13px] leading-5 text-(--pn-accent) transition-[color] duration-120 hover:text-(--pn-accent-hover) hover:underline"
            >
              <span className="truncate max-shell:whitespace-normal max-shell:break-all">
                {project.link.replace(/^https?:\/\//, "")}
              </span>
              <ExternalLink aria-hidden className="size-3 shrink-0" />
            </a>
          </Hint>
        ) : (
          <Unset className="text-[13px]" />
        )}
      </div>
    </div>
  )

  const view = (
    <TranslationGroup className="shell:pl-[62px]">
      <TranslationPanel lang="it">
        <TranslationText lines={4}>{project.descriptionIt}</TranslationText>
      </TranslationPanel>
      <TranslationPanel lang="en">
        <TranslationText lines={4}>{project.descriptionEn}</TranslationText>
      </TranslationPanel>
    </TranslationGroup>
  )

  const edit = session && (
    <>
      <div className="flex min-w-0 items-center gap-3">
        <WebLogoUpload
          src={session.values.logo}
          name={session.values.title}
          fallback="PR"
          rules={PROJECT_LOGO_RULES}
          disabled={session.saving}
          onChange={({ file, preview }) => session.onChange({ ...session.values, logo: preview, logoFile: file })}
          onError={session.onLogoError}
        />
        {draft && (
          <StatusBadge tone="warning" className="ml-auto">
            Draft
          </StatusBadge>
        )}
      </div>
      <div className="grid gap-3.5 min-[900px]:grid-cols-2">
        <InlineEditInput
          ref={titleRef}
          showLabel
          label="Project title"
          placeholder="Project title"
          value={session.values.title}
          maxLength={PROJECT_TITLE_MAX_LENGTH}
          onChange={(event) => session.onChange({ ...session.values, title: event.target.value })}
        />
        <InlineEditInput
          showLabel
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
      </div>
      <TranslationGroup>
        <TranslationPanel lang="it" editing>
          <InlineEditTextarea
            bare
            label="Italian description"
            lang="it"
            placeholder="Descrizione in italiano"
            value={session.values.descriptionIt}
            maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => session.onChange({ ...session.values, descriptionIt: event.target.value })}
          />
        </TranslationPanel>
        <TranslationPanel lang="en" editing>
          <InlineEditTextarea
            bare
            label="English description"
            lang="en"
            placeholder="Description in English"
            value={session.values.descriptionEn}
            maxLength={PROJECT_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => session.onChange({ ...session.values, descriptionEn: event.target.value })}
          />
        </TranslationPanel>
      </TranslationGroup>
    </>
  )

  const moveMenu = (
    <Menu>
      <MenuTrigger
        render={
          <IconButton label="Move project" ariaLabel={`Move ${project.title}`} icon={FolderInput} pending={moving} />
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
      trigger={
        <IconButton
          label="Delete project"
          ariaLabel={`Delete ${project.title}`}
          icon={Trash2}
          tone="danger"
          disabled={moving}
        />
      }
    />
  )

  return (
    <div
      ref={ref}
      role={sortable ? "group" : undefined}
      aria-label={sortable ? project.title : undefined}
      aria-roledescription={sortable ? "sortable project" : undefined}
      className={cn(
        "group/project rounded-(--pn-r-5)",
        sortable && "cursor-grab select-none active:cursor-grabbing",
        (isDragging || isDropping) && "z-10 scale-[1.01] opacity-90 shadow-(--pn-shadow-float)"
      )}
    >
      <InlineEditCard
        className={cn(
          "relative transition-[border-color] duration-120",
          draggable && "shell:pl-8",
          sortable && "group-hover/project:border-(--pn-hover-line)"
        )}
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
        editDisabled={moving}
        handle={handle}
        leadingActions={moveMenu}
        deleteAction={deleteButton}
        viewHeader={viewHeader}
        view={view}
        edit={edit}
      />
    </div>
  )
}

function noop() {}
