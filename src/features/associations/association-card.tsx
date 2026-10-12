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
  TranslationGroup,
  TranslationPanel,
  TranslationText,
} from "@/components/primitives"
import { Count } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { WebLogo, WebLogoUpload } from "../web/logo-upload"
import { focusOnFinePointer } from "../web/web-card"
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

  const viewHeader = (
    <div className="flex h-10 min-w-0 items-center gap-3">
      <WebLogo src={association.logo} name={association.name} fallback="AS" />
      <p title={association.name} className="text-[17px] leading-6 font-semibold text-(--pn-fg)">
        {association.name}
      </p>
    </div>
  )

  const view = (
    <>
      <div className="flex flex-col gap-3">
        {(
          [
            { lang: "it", text: association.descriptionIt },
            { lang: "en", text: association.descriptionEn },
          ] as const
        ).map(({ lang, text }) => (
          <div key={lang} lang={lang} className="flex items-start gap-2.5">
            <span className="mt-0.5 inline-flex h-4.5 shrink-0 items-center rounded-(--pn-r-1) border border-(--pn-line) px-1.25 font-mono text-[10px] text-(--pn-fg-muted)">
              {lang.toUpperCase()}
            </span>
            <TranslationText>{text}</TranslationText>
          </div>
        ))}
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
      <TranslationGroup>
        <TranslationPanel lang="it" editing>
          <InlineEditTextarea
            bare
            label="Italian description"
            lang="it"
            placeholder="Descrizione in italiano"
            value={session.values.descriptionIt}
            maxLength={ASSOCIATION_DESCRIPTION_MAX_LENGTH}
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
            maxLength={ASSOCIATION_DESCRIPTION_MAX_LENGTH}
            onChange={(event) => session.onChange({ ...session.values, descriptionEn: event.target.value })}
          />
        </TranslationPanel>
      </TranslationGroup>
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
      viewHeader={viewHeader}
      view={view}
      viewFooter={
        canWrite ? (
          <Button variant="ghost" size="sm" onClick={onManageLinks} className={buttonMotion}>
            <Link2 aria-hidden data-icon="inline-start" />
            Manage links
          </Button>
        ) : (
          <Count value={publicLinkCount(association)} noun="public link" className="text-xs" />
        )
      }
      edit={edit}
    />
  )
}

function noop() {}
