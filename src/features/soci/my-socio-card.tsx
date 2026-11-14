import { Receipt, Upload, UserPen } from "lucide-react"
import type { ReactNode } from "react"

import { buttonMotion, InlineAlert, KeyValueList, type KeyValueItem, SectionCard, Unset } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { formatDay, todayIso } from "@/features/people/people-format"
import { useDialogState } from "@/features/people/people-hooks"
import { Row, RowIcon, Rows, StateBadge, SubHeading } from "@/features/people/people-ui"
import { cn } from "@/lib/utils"

import { CopyButton, FeeBadge, feeSummary } from "./fee-ui"
import { CompleteDetailsDialog, UploadReceiptDialog } from "./my-socio-dialogs"
import { formatEuro, pastDeadline } from "./soci-fees"
import { END_REASON, formatMemberNumber, socioStatus } from "./soci-format"
import type { Fee, Me } from "./soci.contract"

const FIELD_NAMES = {
  codiceFiscale: "codice fiscale",
  birthDate: "birth date",
  birthPlace: "birth place",
  residence: "residence",
  phone: "phone",
} as const

const listFormat = new Intl.ListFormat("en-GB", { type: "conjunction" })

/** "IT60 X054 2811 …": an IBAN in groups of four, as banks print it. */
const groupedIban = (iban: string) => iban.replace(/\s/g, "").replace(/(.{4})(?=.)/g, "$1 ")

function Copyable({ value, what, children }: { value: string; what: string; children?: ReactNode }) {
  return (
    <span className="flex min-w-0 items-center gap-1">
      <span className="min-w-0 [overflow-wrap:anywhere]">{children ?? value}</span>
      <span className="-my-2 shrink-0">
        <CopyButton value={value} what={what} />
      </span>
    </span>
  )
}

/**
 * Account › My area's Socio card, for a socio found by their Microsoft 365 account: the membership, this year's fee
 * (how to pay and Upload transfer receipt while Due, the review state once uploaded, the last rejection), past fees,
 * and the bookkeeping details, with Complete your details while some are missing.
 */
export function MySocioCards({ me }: { me: Me }) {
  const uploadDialog = useDialogState()
  const detailsDialog = useDialogState()
  const ended = me.endedOn !== null
  const current = me.fees.find((fee) => fee.year === me.payment.year) ?? null
  // An ended socio has no current fee section: every fee, this year's too, is a past one.
  const past = ended ? me.fees : me.fees.filter((fee) => fee !== current)
  const canUpload = !ended && (current?.status === "due" || current?.status === "uploaded")
  const missing = ended ? [] : me.missing

  const membership: KeyValueItem[] = [
    { key: "Member number", value: <span className="font-mono">{formatMemberNumber(me.number)}</span> },
    { key: "Admitted on", value: formatDay(me.admittedOn) },
    ...(me.endedOn
      ? [
          { key: "Ended on", value: formatDay(me.endedOn) },
          { key: "Reason", value: me.endReason ? END_REASON[me.endReason] : <Unset /> },
        ]
      : []),
  ]

  const value = (text: string | null, mono = false) =>
    text ? <span className={cn("[overflow-wrap:anywhere]", mono && "font-mono")}>{text}</span> : <Unset />
  const details: KeyValueItem[] = [
    { key: "Legal name", value: `${me.details.firstName} ${me.details.lastName}` },
    { key: "Alias", value: value(me.details.alias) },
    { key: "Codice fiscale", value: value(me.details.codiceFiscale, true) },
    { key: "Birth date", value: me.details.birthDate ? formatDay(me.details.birthDate) : <Unset /> },
    { key: "Birth place", value: value(me.details.birthPlace) },
    { key: "Residence", value: value(me.details.residence) },
    { key: "Phone", value: value(me.details.phone) },
  ]

  return (
    <div className="grid items-start gap-4 min-[1100px]:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <SectionCard title="Socio" action={<StateBadge state={socioStatus(me)} />} padding="flush">
        <div className="border-b border-(--pn-line) p-4">
          <KeyValueList items={membership} />
        </div>
        {ended ? null : (
          <section aria-labelledby="my-fee" className="flex flex-col gap-4 border-b border-(--pn-line) p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="my-fee" className="text-[14px] font-semibold">
                Fee <span className="font-mono">{me.payment.label}</span>
              </h3>
              <FeeBadge status={current?.status ?? null} />
            </div>
            <CurrentFee me={me} fee={current} />
            {canUpload ? (
              <div>
                <Button
                  variant={current?.status === "uploaded" ? "outline" : "default"}
                  className={cn(buttonMotion, "h-10 max-shell:w-full")}
                  onClick={uploadDialog.show}
                >
                  <Upload data-icon="inline-start" />
                  {current?.status === "uploaded" ? "Replace receipt" : "Upload transfer receipt"}
                </Button>
              </div>
            ) : null}
          </section>
        )}
        <Rows>
          <SubHeading>Past fees</SubHeading>
          {past.length ? (
            past.map((fee) => (
              <Row
                key={fee.year}
                lead={<RowIcon icon={Receipt} />}
                title={<span className="font-mono">{fee.label}</span>}
                meta={feeSummary(fee)}
                end={<FeeBadge status={fee.status} />}
              />
            ))
          ) : (
            <li className="px-4 pb-3 text-[13px] text-(--pn-fg-muted)">None yet.</li>
          )}
        </Rows>
      </SectionCard>

      <SectionCard
        title="My details"
        action={
          missing.length ? (
            <Button size="sm" variant="outline" className={buttonMotion} onClick={detailsDialog.show}>
              <UserPen data-icon="inline-start" />
              Complete your details
            </Button>
          ) : undefined
        }
      >
        <div className="flex flex-col gap-4">
          {missing.length ? (
            <InlineAlert tone="warning">
              The Libro Soci still lacks your {listFormat.format(missing.map((key) => FIELD_NAMES[key]))}. Complete your
              details: the association must keep them.
            </InlineAlert>
          ) : null}
          <KeyValueList items={details} />
          <p className="text-xs text-(--pn-fg-muted)">
            {ended ? "Your status has ended." : "To change something already recorded, ask the Direttivo."}
          </p>
        </div>
      </SectionCard>

      {canUpload ? (
        <UploadReceiptDialog
          key={`upload-${uploadDialog.key}`}
          open={uploadDialog.open}
          onOpenChange={uploadDialog.onOpenChange}
          payment={me.payment}
          replacing={current?.status === "uploaded"}
        />
      ) : null}
      {missing.length || detailsDialog.open ? (
        <CompleteDetailsDialog
          key={`details-${detailsDialog.key}`}
          open={detailsDialog.open}
          onOpenChange={detailsDialog.onOpenChange}
          me={me}
        />
      ) : null}
    </div>
  )
}

/** This year's fee: how to pay while Due, the review state once uploaded, or the payment or exemption. */
function CurrentFee({ me, fee }: { me: Me; fee: Fee | null }) {
  const { payment } = me
  if (!fee)
    return (
      <p className="text-[14px] text-pretty text-(--pn-fg-muted)">
        Your {payment.label} fee isn't open yet. It opens within a day: check back tomorrow.
      </p>
    )
  if (fee.status === "exempt")
    return (
      <p className="text-[14px] text-pretty">
        You're exempt from the {fee.label} fee: soci admitted from 1 June to 31 August don't pay the next year.
      </p>
    )
  if (fee.status === "paid") return <p className="text-[14px] text-pretty">{feeSummary(fee)}.</p>
  if (fee.status === "uploaded" && fee.upload)
    return (
      <p className="text-[14px] text-pretty">
        Your receipt is waiting for the Direttivo's review: a transfer of{" "}
        <span className="tabular-nums">{formatEuro(fee.upload.declaredCents)}</span> on{" "}
        {formatDay(fee.upload.transferDate)}, uploaded {formatDay(fee.upload.uploadedAt)}. You'll get an email once it's
        reviewed.
      </p>
    )
  const late = pastDeadline(fee.year, todayIso())
  return (
    <>
      {fee.lastRejection ? (
        <InlineAlert tone="danger">
          Your receipt was rejected on {formatDay(fee.lastRejection.at)}: {fee.lastRejection.reason}
        </InlineAlert>
      ) : null}
      <p className="text-[14px] text-pretty">
        Pay <span className="font-medium tabular-nums">{formatEuro(payment.amountCents)}</span> by bank transfer{" "}
        {late ? "now: the deadline was" : "by"} {formatDay(payment.deadline)}, then upload the bank's transfer receipt.
      </p>
      {payment.iban && payment.beneficiary ? (
        <div className="rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-sunken) px-3.5 py-3">
          <KeyValueList
            items={[
              { key: "Beneficiary", value: <Copyable value={payment.beneficiary} what="Beneficiary" /> },
              {
                key: "IBAN",
                value: (
                  <Copyable value={payment.iban.replace(/\s/g, "")} what="IBAN">
                    <span className="font-mono text-[13px]">{groupedIban(payment.iban)}</span>
                  </Copyable>
                ),
              },
              {
                key: "Amount",
                value: (
                  <Copyable value={(payment.amountCents / 100).toFixed(2)} what="Amount">
                    <span className="tabular-nums">{formatEuro(payment.amountCents)}</span>
                  </Copyable>
                ),
              },
              {
                key: "Reference",
                value: (
                  <Copyable value={payment.reference} what="Reference">
                    <span className="font-mono text-[13px]">{payment.reference}</span>
                  </Copyable>
                ),
              },
            ]}
          />
        </div>
      ) : (
        <InlineAlert tone="neutral">The bank details aren't set up yet: ask the Direttivo how to pay.</InlineAlert>
      )}
    </>
  )
}
