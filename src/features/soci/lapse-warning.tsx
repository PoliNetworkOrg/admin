import { Link } from "@tanstack/react-router"

import { InlineAlert } from "@/components/primitives"
import { formatDay } from "@/features/people/people-format"

import { socioName } from "./soci-format"
import type { LapsePreview } from "./soci.contract"

export function LapseWarning({ preview }: { preview: LapsePreview }) {
  if (!preview.enabled || !preview.members.length) return null
  return (
    <InlineAlert tone="warning">
      <details>
        <summary className="cursor-pointer">
          {preview.members.length} soci would lapse in the preview for {formatDay(preview.evaluatedOn)} if their fees
          remain unpaid.
        </summary>
        <ul className="mt-2 list-inside list-disc">
          {preview.members.map((s) => (
            <li key={s.number}>
              <Link to="/dashboard/people/soci/$number" params={{ number: String(s.number) }} className="underline">
                {socioName(s)}
              </Link>
              {" · "}
              {s.mailbox}
              {" · end date: "}
              {formatDay(s.endedOn)}
            </li>
          ))}
        </ul>
      </details>
    </InlineAlert>
  )
}
