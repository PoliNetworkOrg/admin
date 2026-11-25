import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
  fieldControl,
  fieldHintId,
  FormDialog,
  FormField,
} from "@/components/primitives"
import { Input } from "@/components/ui/input"
import type { TgGroup } from "@/lib/api/types"

import { FreshmanIconPicker } from "./freshman-icon"
import { updateFreshmanTelegramCard } from "./freshman.functions"
import type { FreshmanIcon, FreshmanTelegramCard } from "./types"

/** Links a Telegram slot to a group of the bot's database: the website shows the group's current invite link. */
export function FreshmanTelegramDialog({
  card,
  groups,
  open,
  onClose,
  onSaved,
}: {
  card: FreshmanTelegramCard
  /** The groups an editor can link: those with an invite link. */
  groups: TgGroup[]
  open: boolean
  onClose: () => void
  onSaved: () => Promise<void>
}) {
  const updateFn = useServerFn(updateFreshmanTelegramCard)
  const fieldPrefix = useId()
  const initialGroupId = card.telegramGroup?.telegramId ?? null
  const [group, setGroup] = useState(() => groups.find((item) => item.telegramId === initialGroupId) ?? null)
  const [title, setTitle] = useState(card.customTitle)
  const [icon, setIcon] = useState<FreshmanIcon>(card.icon)
  const [groupError, setGroupError] = useState<string>()
  const dirty =
    (group?.telegramId ?? null) !== initialGroupId || title.trim() !== card.customTitle || icon !== card.icon

  async function submit() {
    if (!group) {
      setGroupError("Choose a group.")
      document.getElementById(`${fieldPrefix}-group`)?.focus()
      return
    }
    await updateFn({ data: { id: card.id, title: title.trim(), icon, telegramGroupId: group.telegramId } })
    await onSaved()
  }

  return (
    <FormDialog
      open={open}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={`Edit ${card.title}`}
      description="Link this position to a Telegram group. The website shows the group's current invite link."
      noun="group link"
      dirty={dirty}
      submitLabel="Save changes"
      canSubmit={dirty}
      submitOnEnter={false}
      onSubmit={submit}
    >
      <FormField
        label="Group"
        htmlFor={`${fieldPrefix}-group`}
        error={groupError}
        hint={group?.link ?? "Only groups with an invite link are listed."}
      >
        <Combobox
          items={groups}
          value={group}
          limit={50}
          onValueChange={(next) => {
            setGroup(next)
            setGroupError(undefined)
          }}
          itemToStringLabel={(item) => item.title}
          itemToStringValue={(item) => String(item.telegramId)}
          isItemEqualToValue={(item, value) => item.telegramId === value.telegramId}
        >
          <ComboboxInput
            id={`${fieldPrefix}-group`}
            listLabel="groups"
            placeholder="Search groups…"
            aria-invalid={!!groupError}
            aria-describedby={fieldHintId(`${fieldPrefix}-group`)}
          />
          <ComboboxContent>
            <ComboboxEmpty>No groups match</ComboboxEmpty>
            <ComboboxList>
              {(item: TgGroup) => (
                <ComboboxItem key={item.telegramId} value={item} className="py-1.5">
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{item.title}</span>
                    <span className="truncate text-xs text-(--pn-fg-muted)">
                      {[item.tag && `@${item.tag}`, item.hide && "Hidden", item.link].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </ComboboxItem>
              )}
            </ComboboxList>
          </ComboboxContent>
        </Combobox>
      </FormField>
      <FormField
        label="Display name"
        htmlFor={`${fieldPrefix}-title`}
        optional
        hint="Empty shows the group's name, and follows it when the group is renamed."
      >
        <Input
          id={`${fieldPrefix}-title`}
          value={title}
          maxLength={120}
          placeholder={group?.title}
          aria-describedby={fieldHintId(`${fieldPrefix}-title`)}
          className={fieldControl}
          onChange={(event) => setTitle(event.target.value)}
        />
      </FormField>
      <FreshmanIconPicker value={icon} onValueChange={setIcon} />
    </FormDialog>
  )
}
