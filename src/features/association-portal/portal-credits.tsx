import { useRouter } from "@tanstack/react-router"
import { useServerFn } from "@tanstack/react-start"
import { useId, useState } from "react"
import type { z } from "zod"

import { checkboxControl, FormDialog, InlineAlert, KeyValueList } from "@/components/primitives"
import { appToast, PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"

import { creditInput, formatCredits, parseCredits } from "./portal-format"
import { channelLabel, formatMoment } from "./portal-promotions"
import { grantSemesterCredits, operateCredits, saveCreditConfig } from "./portal-review.functions"
import { panelClass, TextField } from "./portal-ui"
import type { CreditConfig, creditAccountSchema, CreditEntry } from "./portal.contract"

type Account = z.infer<typeof creditAccountSchema>
const kindLabel = {
  credit: "Accredito",
  debit: "Addebito",
  reversal: "Storno",
  adjustment: "Rettifica",
} satisfies Record<CreditEntry["kind"], string>
const channels: (keyof CreditConfig["costs"])[] = [
  "poliassociazioni",
  "course_broadcast",
  "exam_group",
  "level_group",
  "course_groups",
  "other",
]

async function reload(router: ReturnType<typeof useRouter>, message: string) {
  try {
    await router.invalidate({ sync: true })
  } catch (error) {
    console.error(error)
    appToast.warning("Salvato, ma la pagina non si è aggiornata. Ricaricala senza ripetere l’operazione.")
    return
  }
  appToast.success(message)
}

/** The association's balance, expected usage and ledger; operators also grant and adjust. */
export function CreditsTab({
  associationId,
  credits,
  operator,
}: {
  associationId: string
  credits: Account
  operator: boolean
}) {
  const router = useRouter()
  const operate = useServerFn(operateCredits)
  const [dialog, setDialog] = useState<"credit" | "adjustment" | null>(null)
  return (
    <section className={panelClass} aria-labelledby="credits-title">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="credits-title" className="font-medium">
          Crediti per i messaggi promozionali
        </h2>
        {operator && (
          <div className="flex gap-2">
            <Button onClick={() => setDialog("credit")}>Assegna crediti</Button>
            <Button variant="outline" onClick={() => setDialog("adjustment")}>
              Rettifica
            </Button>
          </div>
        )}
      </div>
      {!credits.enabled && (
        <InlineAlert tone="neutral">
          I crediti non sono ancora attivi: le approvazioni non scalano nulla e i referenti non vedono questa sezione.
        </InlineAlert>
      )}
      <KeyValueList
        items={[
          { key: "Saldo", value: formatCredits(credits.balance) },
          { key: "Uso previsto", value: formatCredits(credits.expected), hint: "Richieste in attesa di approvazione." },
        ]}
      />
      <p className="text-sm text-(--pn-fg-muted)">
        Secondo il regolamento ogni semestre arrivano {formatCredits(credits.config.semesterGrant)}, non cumulabili. Un
        invio costa:{" "}
        {channels
          .map((c) =>
            credits.config.costs[c] === null
              ? `${channelLabel[c]}: lo valuta PoliNetwork`
              : `${channelLabel[c]}: ${formatCredits(credits.config.costs[c] ?? 0)}`
          )
          .join("; ")}
        . Sui canali del proprio corso il costo è il {credits.config.ownProgrammePercent}%.
      </p>
      {credits.entries.length === 0 ? (
        <p className="text-sm text-(--pn-fg-muted)">Nessun movimento.</p>
      ) : (
        <ul className="divide-y divide-(--pn-line)">
          {[...credits.entries].reverse().map((e) => (
            <li key={e.id} className="flex flex-wrap items-baseline justify-between gap-3 py-2 text-sm">
              <span className="min-w-0">
                <span className="font-medium">{kindLabel[e.kind]}</span> · {e.reason}
                <span className="block text-(--pn-fg-muted)">
                  {e.authorName} · {formatMoment(e.createdAt)}
                </span>
              </span>
              <span className={`tabular-nums ${e.amount < 0 ? "text-(--pn-danger-fg)" : ""}`}>
                {e.amount > 0 ? "+" : ""}
                {formatCredits(e.amount)}
              </span>
            </li>
          ))}
        </ul>
      )}
      {dialog && (
        <AmountDialog
          kind={dialog}
          onClose={() => setDialog(null)}
          onSubmit={async (amount, reason) => {
            await operate({
              data: { associationId, kind: dialog, amount, reason, commandId: crypto.randomUUID() },
            })
            setDialog(null)
            await reload(router, dialog === "credit" ? "Crediti assegnati." : "Rettifica registrata.")
          }}
        />
      )}
    </section>
  )
}

function AmountDialog({
  kind,
  onClose,
  onSubmit,
}: {
  kind: "credit" | "adjustment"
  onClose: () => void
  onSubmit: (amount: number, reason: string) => Promise<void>
}) {
  const [amount, setAmount] = useState("")
  const [reason, setReason] = useState("")
  const parsed = parseCredits(amount)
  return (
    <FormDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
      title={kind === "credit" ? "Assegna crediti" : "Registra una rettifica"}
      description={
        kind === "credit"
          ? "Il movimento resta nel registro dei crediti con la motivazione."
          : "Positiva aggiunge, negativa toglie (per esempio “-1,5”). I movimenti non si cancellano."
      }
      noun="movimento"
      locale="it"
      dirty={!!amount || !!reason}
      submitLabel={kind === "credit" ? "Assegna" : "Registra"}
      canSubmit={parsed !== null && parsed !== 0 && (kind === "adjustment" || parsed > 0) && !!reason.trim()}
      onSubmit={() => onSubmit(parsed ?? 0, reason)}
    >
      <TextField label="Crediti" value={amount} onChange={setAmount} maxLength={10} />
      <TextField label="Motivazione" value={reason} onChange={setReason} multiline maxLength={4000} />
    </FormDialog>
  )
}

/** Operators: the credit rules (RRI art. 4.7, editable), the on/off switch and the semester grant. */
export function CreditsPage({ config }: { config: CreditConfig }) {
  const router = useRouter()
  const id = useId()
  const save = useServerFn(saveCreditConfig)
  const semester = useServerFn(grantSemesterCredits)
  const text = (n: number | null) => (n === null ? "" : creditInput(n))
  const [rules, setRules] = useState({
    enabled: config.enabled,
    allowNegative: config.allowNegative,
    semesterGrant: text(config.semesterGrant),
    ownProgrammePercent: String(config.ownProgrammePercent),
    cooldownDays: String(config.cooldownDays),
    costs: {
      poliassociazioni: text(config.costs.poliassociazioni),
      course_broadcast: text(config.costs.course_broadcast),
      exam_group: text(config.costs.exam_group),
      level_group: text(config.costs.level_group),
      course_groups: text(config.costs.course_groups),
      other: text(config.costs.other),
    },
  })
  const [period, setPeriod] = useState("")
  const [grant, setGrant] = useState(text(config.semesterGrant))
  const [resetUnused, setResetUnused] = useState(true)
  const [busy, setBusy] = useState(false)
  async function saveRules() {
    const cost = (value: string) => (value.trim() === "" ? null : parseCredits(value))
    const costs: CreditConfig["costs"] = {
      poliassociazioni: cost(rules.costs.poliassociazioni),
      course_broadcast: cost(rules.costs.course_broadcast),
      exam_group: cost(rules.costs.exam_group),
      level_group: cost(rules.costs.level_group),
      course_groups: cost(rules.costs.course_groups),
      other: cost(rules.costs.other),
    }
    const next: CreditConfig = {
      enabled: rules.enabled,
      allowNegative: rules.allowNegative,
      semesterGrant: parseCredits(rules.semesterGrant) ?? 0,
      ownProgrammePercent: Number(rules.ownProgrammePercent),
      cooldownDays: Number(rules.cooldownDays),
      costs,
    }
    if (channels.some((c) => rules.costs[c].trim() !== "" && costs[c] === null))
      throw new Error("Scrivi i costi come numeri, per esempio 0,5.")
    await save({ data: next })
    await reload(router, "Regole salvate.")
  }
  return (
    <>
      <PageBar title="Crediti" description="Regole dei crediti per i messaggi promozionali (RRI, art. 4.7)" />
      <PageContent width="record">
        <div className="space-y-6">
          <section className={panelClass} aria-labelledby={`${id}-rules`}>
            <h2 id={`${id}-rules`} className="font-medium">
              Regole
            </h2>
            <p className="text-sm text-(--pn-fg-muted)">
              I valori iniziali sono quelli dell’RRI. Le decisioni economiche spettano al Direttivo: cambiali solo su
              sua indicazione.
            </p>
            <label className="flex items-start gap-2.5 text-[14px]">
              <Checkbox
                checked={rules.enabled}
                onCheckedChange={(v) => setRules({ ...rules, enabled: v === true })}
                className={checkboxControl}
              />
              <span className="flex flex-col gap-0.5">
                <span className="font-medium">Crediti attivi</span>
                <span className="text-[13px] text-(--pn-fg-muted)">
                  Spenti, le approvazioni non scalano crediti e i referenti non li vedono.
                </span>
              </span>
            </label>
            <div className="grid gap-4 sm:grid-cols-3">
              <TextField
                label="Crediti a semestre"
                value={rules.semesterGrant}
                onChange={(semesterGrant) => setRules({ ...rules, semesterGrant })}
                maxLength={10}
              />
              <TextField
                label="Costo sul proprio corso (%)"
                value={rules.ownProgrammePercent}
                onChange={(ownProgrammePercent) => setRules({ ...rules, ownProgrammePercent })}
                maxLength={3}
              />
              <TextField
                label="Giorni tra due messaggi nello stesso gruppo"
                value={rules.cooldownDays}
                onChange={(cooldownDays) => setRules({ ...rules, cooldownDays })}
                maxLength={3}
              />
            </div>
            <fieldset className="grid gap-4 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-medium">Costo di un invio (vuoto: lo valuta PoliNetwork)</legend>
              {channels.map((c) => (
                <TextField
                  key={c}
                  label={channelLabel[c]}
                  value={rules.costs[c]}
                  onChange={(v) => setRules({ ...rules, costs: { ...rules.costs, [c]: v } })}
                  maxLength={10}
                />
              ))}
            </fieldset>
            <label className="flex items-start gap-2.5 text-[14px]">
              <Checkbox
                checked={rules.allowNegative}
                onCheckedChange={(v) => setRules({ ...rules, allowNegative: v === true })}
                className={checkboxControl}
              />
              <span className="font-medium">Consenti il saldo negativo</span>
            </label>
            <Button
              disabled={busy}
              onClick={async () => {
                setBusy(true)
                try {
                  await saveRules()
                } catch (error) {
                  console.error(error)
                  appToast.error(error instanceof Error ? error.message : "Non è stato possibile salvare le regole.")
                } finally {
                  setBusy(false)
                }
              }}
            >
              Salva regole
            </Button>
          </section>
          <section className={panelClass} aria-labelledby={`${id}-semester`}>
            <h2 id={`${id}-semester`} className="font-medium">
              Crediti del semestre
            </h2>
            <p className="text-sm text-(--pn-fg-muted)">
              Assegna i crediti a tutte le associazioni attive. Ogni periodo si assegna una volta sola; i crediti non
              usati possono scadere, come prevede il regolamento.
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Periodo"
                value={period}
                onChange={setPeriod}
                maxLength={40}
                hint="Per esempio “2026-27 S2”."
              />
              <TextField label="Crediti" value={grant} onChange={setGrant} maxLength={10} />
            </div>
            <label className="flex items-start gap-2.5 text-[14px]">
              <Checkbox
                checked={resetUnused}
                onCheckedChange={(v) => setResetUnused(v === true)}
                className={checkboxControl}
              />
              <span className="font-medium">Fai scadere i crediti non usati</span>
            </label>
            <Button
              variant="outline"
              disabled={busy || !period.trim() || !parseCredits(grant)}
              onClick={async () => {
                setBusy(true)
                try {
                  const { granted } = await semester({
                    data: {
                      period,
                      amount: parseCredits(grant) ?? 0,
                      resetUnused,
                      reason: `Crediti del semestre ${period}`,
                    },
                  })
                  await reload(
                    router,
                    granted === 1
                      ? "Crediti assegnati a 1 associazione."
                      : `Crediti assegnati a ${granted} associazioni.`
                  )
                } catch (error) {
                  console.error(error)
                  appToast.error(error instanceof Error ? error.message : "Non è stato possibile assegnare i crediti.")
                } finally {
                  setBusy(false)
                }
              }}
            >
              Assegna i crediti del semestre
            </Button>
          </section>
        </div>
      </PageContent>
    </>
  )
}
