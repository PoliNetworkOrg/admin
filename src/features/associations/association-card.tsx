import { Link2, Trash2 } from "lucide-react"
import { useEffect, useRef } from "react"

import {
  buttonMotion,
  ConfirmDialog,
  IconButton,
  InlineEditCard,
  InlineEditInput,
  InlineEditTextarea,
  StatusBadge,
} from "@/components/primitives"
import { Count } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { WebLogo, WebLogoUpload } from "../web/logo-upload"
import { focusOnFinePointer, LanguageChip, LanguageTerm } from "../web/web-card"
import {
  ASSOCIATION_DESCRIPTION_MAX_LENGTH,
  ASSOCIATION_LINK_FIELDS,
  ASSOCIATION_LOGO_RULES,
  ASSOCIATION_NAME_MAX_LENGTH,
} from "./associations.constants"
import type { Association, AssociationForm } from "./types"

/** The open inline edit, owned by the page so only one card edits at a time. */
export type AssociationEditSession = {
  values: AssociationForm
  onChange: (values: AssociationForm) => void
  dirty: boolean
  valid: boolean
  saving: boolean
  error?: string
  /** Logo validation message, shown in the card footer. */
  message?: string
  onSave: () => void
  onCancel: () => void
  onLogoError: (message: string | null) => void
}

type AssociationCardProps = {
  association: Association
  draft?: boolean
  canWrite: boolean
  session: AssociationEditSession | null
  onEdit: () => void
  /** Throws to keep the confirm dialog open with the error. */
  onDelete: () => Promise<void>
  onManageLinks: () => void
}

function publicLinkCount(association: Association) {
  return ASSOCIATION_LINK_FIELDS.filter(({ key }) => association.links[key]?.trim()).length
}

export function AssociationCard({
  association,
  draft = false,
  canWrite,
  session,
  onEdit,
  onDelete,
  onManageLinks,
}: AssociationCardProps) {
  const editing = session !== null
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editing) focusOnFinePointer(nameRef.current)
  }, [editing])

  const view = (
    <>
      <div className="flex h-10 min-w-0 items-center gap-3">
        <WebLogo src={association.logo} name={association.name} fallback="AS" />
        <p title={association.name} className="truncate text-sm leading-5 font-medium text-(--pn-fg)">
          {association.name}
        </p>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3">
        <LanguageTerm code="IT" name="Italian" />
        <dd lang="it" className="line-clamp-5 text-[13px] leading-5 text-pretty whitespace-pre-line text-(--pn-fg)">
          {association.descriptionIt}
        </dd>
        <LanguageTerm code="EN" name="English" />
        <dd lang="en" className="line-clamp-5 text-[13px] leading-5 text-pretty whitespace-pre-line text-(--pn-fg)">
          {association.descriptionEn}
        </dd>
      </dl>
      {/* Pinned to the bottom so cards sharing a grid row line their footers up. */}
      <div className="mt-auto flex min-h-9 items-center gap-2">
        <Count value={publicLinkCount(association)} noun="public link" className="text-xs" />
        {canWrite && (
          <Button variant="ghost" size="sm" onClick={onManageLinks} className={buttonMotion}>
            <Link2 data-icon="inline-start" />
            Manage links
          </Button>
        )}
      </div>
    </>
  )

  const edit = session && (
    <>
      <div className="flex h-10 min-w-0 items-center gap-3">
        <WebLogoUpload
          src={session.values.logo}
          name={session.values.name}
          fallback="AS"
          rules={ASSOCIATION_LOGO_RULES}
          disabled={session.saving}
          onChange={({ file, preview }) => session.onChange({ ...session.values, logo: preview, logoFile: file })}
          onError={session.onLogoError}
        />
        <InlineEditInput
          ref={nameRef}
          label="Association name"
          placeholder="Association name"
          value={session.values.name}
          maxLength={ASSOCIATION_NAME_MAX_LENGTH}
          onChange={(event) => session.onChange({ ...session.values, name: event.target.value })}
        />
        {draft && <StatusBadge tone="warning">Draft</StatusBadge>}
      </div>
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-3">
        <LanguageChip code="IT" className="mt-2.5" />
        <InlineEditTextarea
          label="Italian description"
          lang="it"
          placeholder="Descrizione in italiano"
          value={session.values.descriptionIt}
          maxLength={ASSOCIATION_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => session.onChange({ ...session.values, descriptionIt: event.target.value })}
        />
        <LanguageChip code="EN" className="mt-2.5" />
        <InlineEditTextarea
          label="English description"
          lang="en"
          placeholder="Description in English"
          value={session.values.descriptionEn}
          maxLength={ASSOCIATION_DESCRIPTION_MAX_LENGTH}
          onChange={(event) => session.onChange({ ...session.values, descriptionEn: event.target.value })}
        />
      </div>
    </>
  )

  return (
    <InlineEditCard
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
      editLabel="Edit association"
      editAriaLabel={`Edit ${association.name}`}
      deleteAction={
        <ConfirmDialog
          title="Delete association?"
          description={`${association.name} is removed from the website. This cannot be undone.`}
          confirmLabel="Delete association"
          onConfirm={onDelete}
          trigger={
            <IconButton
              label="Delete association"
              ariaLabel={`Delete ${association.name}`}
              icon={Trash2}
              tone="danger"
            />
          }
        />
      }
      view={view}
      edit={edit}
    />
  )
}

function noop() {}
