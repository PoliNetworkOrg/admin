import { Hash, Pencil } from "lucide-react"

import {
  buttonMotion,
  InlineAlert,
  KeyValueList,
  type KeyValueItem,
  RecordHeader,
  SectionCard,
  SectionEmpty,
  Unset,
} from "@/components/primitives"
import { PageBar, PageContent, useCan } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { actorName, formatDay } from "@/features/people/people-format"
import { useDialogState } from "@/features/people/people-hooks"
import { PersonAvatar, Row, Rows, StateBadge } from "@/features/people/people-ui"
import type { PersonRow } from "@/features/people/people.contract"
import { formatDateTime } from "@/lib/format"

import {
  ACCOUNT_STATE,
  END_REASON,
  formatMemberNumber,
  MISMATCH,
  missingDetails,
  socioName,
  socioStatus,
} from "./soci-format"
import type { SocioRecord, SocioRow } from "./soci.contract"
import { ChangeNumberDialog, EditSocioDialog } from "./socio-dialogs"

const BACK = { label: "the register", link: { to: "/dashboard/people/soci" } } as const

const value = (text: string | null, mono = false) =>
  text ? <span className={mono ? "font-mono" : undefined}>{text}</span> : <Unset />

/** One socio: the bookkeeping data, the Microsoft 365 account and the record's history. */
export function SocioPage({
  socio,
  register,
  people,
}: {
  socio: SocioRecord
  register: SocioRow[]
  /** People records, to name who did what; empty without `people:read`. */
  people: PersonRow[]
}) {
  const canWrite = useCan("soci:write")
  const edit = useDialogState()
  const changeNumber = useDialogState()
  const name = socioName(socio)
  const missing = missingDetails(socio)
  const deleted = socio.accountState === "deleted"
  const numberDiffers = socio.accountNumber !== null && socio.accountNumber !== String(socio.number)

  const details: KeyValueItem[] = [
    { key: "Legal name", value: name },
    { key: "Alias", value: value(socio.alias) },
    { key: "Codice fiscale", value: value(socio.codiceFiscale, true) },
    { key: "Birth date", value: socio.birthDate ? formatDay(socio.birthDate) : <Unset /> },
    { key: "Birth place", value: value(socio.birthPlace) },
    { key: "Residence", value: value(socio.residence) },
    { key: "Phone", value: value(socio.phone) },
  ]
  const admission: KeyValueItem[] = [
    { key: "Member number", value: <span className="font-mono">{formatMemberNumber(socio.number)}</span> },
    { key: "Admitted on", value: formatDay(socio.admittedOn) },
    ...(socio.endedOn
      ? [
          { key: "Ended on", value: formatDay(socio.endedOn) },
          { key: "Reason", value: socio.endReason ? END_REASON[socio.endReason] : <Unset /> },
          { key: "Note", value: value(socio.endNote) },
        ]
      : []),
  ]
  const account: KeyValueItem[] = [
    { key: "Mailbox", value: <span className="font-mono break-all">{socio.mailbox}</span> },
    { key: "Display name", value: socio.displayName },
    { key: "Account", value: <StateBadge state={ACCOUNT_STATE[socio.accountState]} /> },
    ...(deleted
      ? [{ key: "Deleted on", value: socio.accountDeletedOn ? formatDay(socio.accountDeletedOn) : <Unset /> }]
      : [
          {
            key: "Soci group",
            value: socio.inSoci === null ? <Unset /> : socio.inSoci ? "Member" : "Not a member",
          },
          { key: "Number in Microsoft 365", value: value(socio.accountNumber, true) },
        ]),
    { key: "Object ID", value: <span className="font-mono text-xs break-all">{socio.entraObjectId}</span> },
  ]

  return (
    <>
      <PageBar width="record" back={BACK} crumb="Soci" context={name} />
      <PageContent width="record">
        <div className="flex flex-col gap-6">
          <RecordHeader
            title={name}
            avatar={<PersonAvatar name={name} size={64} muted={!!socio.endedOn} />}
            badge={<StateBadge state={socioStatus(socio)} />}
            meta={
              <>
                <span className="font-mono">{formatMemberNumber(socio.number)}</span>
                {socio.alias ? <> · goes by {socio.alias}</> : null}
              </>
            }
            actions={
              canWrite ? (
                <>
                  <Button size="sm" variant="outline" className={buttonMotion} onClick={edit.show}>
                    <Pencil data-icon="inline-start" />
                    Edit
                  </Button>
                  {deleted ? null : (
                    <Button size="sm" variant="outline" className={buttonMotion} onClick={changeNumber.show}>
                      <Hash data-icon="inline-start" />
                      Change number
                    </Button>
                  )}
                </>
              ) : undefined
            }
          />

          {socio.mismatch || numberDiffers || (missing.length && !socio.endedOn) ? (
            <div className="flex flex-col gap-2">
              {socio.mismatch ? (
                <InlineAlert tone="warning">
                  {MISMATCH[socio.mismatch]}.{" "}
                  {socio.mismatch === "still_in_soci"
                    ? "The account still has the Socio role."
                    : "The account doesn't have the Socio role."}
                </InlineAlert>
              ) : null}
              {numberDiffers ? (
                <InlineAlert tone="warning">
                  Microsoft 365 has number {socio.accountNumber} on the account, not {formatMemberNumber(socio.number)}.
                  Correct it in Microsoft 365, or use Change number to give both a new number.
                </InlineAlert>
              ) : null}
              {missing.length && !socio.endedOn ? (
                <InlineAlert tone="neutral">Missing: {missing.join(", ")}.</InlineAlert>
              ) : null}
            </div>
          ) : null}

          <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
            <div className="flex min-w-0 flex-col gap-4">
              <SectionCard title="Bookkeeping data">
                <KeyValueList items={details} />
              </SectionCard>
              <SectionCard title="Admission">
                <KeyValueList items={admission} />
              </SectionCard>
            </div>
            <SectionCard title="Microsoft 365 account">
              <KeyValueList items={account} />
            </SectionCard>
          </div>

          <SectionCard title="Activity" count={socio.activity.length} padding="flush">
            {socio.activity.length === 0 ? (
              <SectionEmpty title="No activity yet" />
            ) : (
              <Rows>
                {socio.activity.map((entry) => {
                  const actor = actorName(entry.actor, people)
                  return (
                    <Row
                      key={`${entry.at}-${entry.text}`}
                      lead={<PersonAvatar name={actor} size={24} />}
                      title={
                        <span className="font-normal [overflow-wrap:anywhere]">
                          <span className="font-medium">{actor}</span> {entry.text}
                        </span>
                      }
                      meta={formatDateTime(new Date(entry.at))}
                    />
                  )
                })}
              </Rows>
            )}
          </SectionCard>
        </div>
      </PageContent>
      {canWrite ? (
        <EditSocioDialog
          key={`edit-${edit.key}`}
          open={edit.open}
          onOpenChange={edit.onOpenChange}
          socio={socio}
          register={register}
        />
      ) : null}
      {canWrite && !deleted ? (
        <ChangeNumberDialog
          key={`number-${changeNumber.key}`}
          open={changeNumber.open}
          onOpenChange={changeNumber.onOpenChange}
          socio={socio}
        />
      ) : null}
    </>
  )
}
