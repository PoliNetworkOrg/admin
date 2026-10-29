import { FileDown, FileText, Upload } from "lucide-react"

import { buttonMotion, KeyValueList, SectionCard } from "@/components/primitives"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { MockupBanner } from "./mockup-banner"
import { formatCents, MOCK_FEE_STATUS, MOCK_MY_FEE } from "./mockup-data"
import { formatDay } from "./people-format"
import { Row, RowIcon, Rows, StateBadge, SubHeading } from "./people-ui"

/**
 * My area's fee card, as an unconnected mockup with sample data (Phase 2, #144): how a member would pay and upload
 * the bank's transfer receipt, and download their signed receipts. Nothing is read or sent; every action is disabled.
 */
export function MyFeeCard() {
  const fee = MOCK_MY_FEE
  return (
    <SectionCard
      title={`Membership fee ${fee.year} (mockup)`}
      action={<StateBadge state={MOCK_FEE_STATUS[fee.status]} />}
      padding="flush"
    >
      <div className="flex flex-col gap-4 border-b border-(--pn-line) p-4">
        <MockupBanner phase={2} />
        <p className="text-[14px] text-pretty">
          Pay <span className="font-medium tabular-nums">{formatCents(fee.amountCents)}</span> by bank transfer by{" "}
          {formatDay(fee.dueOn)}, then upload the bank’s transfer receipt.
        </p>
        <div className="rounded-(--pn-r-4) border border-(--pn-line) bg-(--pn-sunken) px-3.5 py-3">
          <KeyValueList
            items={[
              { key: "Beneficiary", value: fee.instructions.beneficiary },
              { key: "IBAN", value: <span className="font-mono text-[13px]">{fee.instructions.iban}</span> },
              { key: "Amount", value: <span className="tabular-nums">{formatCents(fee.amountCents)}</span> },
              { key: "Reference", value: <span className="font-mono text-[13px]">{fee.instructions.reference}</span> },
            ]}
          />
        </div>
        <div>
          <Button className={cn(buttonMotion, "h-10 max-shell:w-full")} disabled>
            <Upload data-icon="inline-start" />
            Upload transfer receipt
          </Button>
        </div>
      </div>
      <Rows>
        <SubHeading>Your receipts</SubHeading>
        {fee.receipts.map((receipt) => (
          <Row
            key={receipt.id}
            lead={<RowIcon icon={FileText} />}
            title={
              <>
                <span className="font-mono">{receipt.number}</span>
                <span className="text-[13px] font-normal text-(--pn-fg-muted)">
                  Fee <span className="font-mono">{receipt.year}</span>
                </span>
              </>
            }
            meta={`Sent ${formatDay(receipt.sentOn)}`}
            end={
              <Button
                size="sm"
                variant="outline"
                className={buttonMotion}
                aria-label={`Download receipt ${receipt.number}`}
                disabled
              >
                <FileDown data-icon="inline-start" />
                PDF
              </Button>
            }
          />
        ))}
      </Rows>
    </SectionCard>
  )
}
