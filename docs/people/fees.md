# People area: fees and receipts

How a member renews and gets a receipt. Shapes and procedures are in [`contract.md`](contract.md) ("Fees and
receipts"); `src/features/people/people.contract.ts` stays the source of truth. The design canvas (desktop and mobile,
light and dark, every state) is <https://claude.ai/artifact/LoNAUNpx6bfgRni9Bhqkyy>, private to the owner; like the
People prototype it fixes structure and copy, while spacing comes from the primitives.

## The flow

1. **The member pays** by bank transfer, outside the dashboard, with the reference My area gives them
   (`Quota 2026/27 0344 Name Surname`), then uploads the bank's transfer receipt in **Account › My area** with the
   transfer date and amount. The fee turns **Receipt uploaded**.
2. **An admin reviews** it (`people:fees:write`) from **People › Member register** or the person's record: **Approve**
   or **Reject** with a reason the member reads in My area and in the email. Without an upload, **Mark as paid** records
   a payment by hand (date, amount, bank transfer or cash, optional note). Every change shows at once.
3. **The system issues the receipt** on approval or Mark as paid: a PDF filled in from the record, numbered in issue
   order per fee year (`2026/042`: the fee year's first calendar year and a sequence never reused, voided ones
   included). It is **To sign**.
4. **The President signs** (`people:receipts:sign`, plus `esign:sign` for CIE): **People › Receipts › Sign with CIE**
   opens the existing [PoliNetwork eSign](https://github.com/PoliNetworkOrg/esign) flow, up to 10 receipts with one PIN.
   The backend prepares or reuses a durable eSign request for each receipt, fixing the PDF and its signing officer.
   The PIN stays in the local eSign window. Completion saves the signed PDF and emails it to the member even if the
   dashboard has closed. A receipt becomes **Signed**, then **Sent**, or **Send failed** with Retry sending on the row.
   **Download to sign** and **Upload signed** remain available in the signing options for signing externally with the
   CIE app. The backend matches uploaded files by number, verifies their signature and lets the officer correct matches.
5. **The President's own receipt** is signed by the **Vice-president**: it waits in their queue, and the President's
   upload marks it **Needs another signer**.
6. Receipts are **never deleted**. **Void receipt** keeps the number and the file with a reason; voiding this year's
   only receipt reopens the fee (Due, or Unpaid after the deadline) so a correct one can be issued.

Fee states (from the People contract, unchanged): **Due** (warning) before the deadline, **Receipt uploaded** (brand),
**Paid** (success), **Unpaid** (danger) after the deadline. Receipt states: **To sign** (warning), **Signed** (brand),
**Sent** (success), **Send failed** (danger), **Voided** (neutral).

## Reminders

- **Automatic**, by the backend: an email 14 and 3 days before the deadline (31 Oct for 2026/27) to every current
  member whose fee is Due. The dashboard shows when the last one went out.
- **By hand**: Send reminder on a register row or record (no confirmation: it only sends an email), or the register's
  page action **Send reminders**, which confirms first and skips members reminded in the last 3 days.
- Every reminder, upload, review, payment, signature, email and void is a line in the person's Activity.

## Permissions

| Permission             | Gives                                                                                                                                |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| `people:members:read`  | People › Receipts (read-only), the record's Fees and receipts card, receipt downloads                                                |
| `people:fees:write`    | Review receipt, Mark as paid, Send reminder(s), Retry sending, Void receipt                                                          |
| `people:receipts:sign` | Prepare CIE receipt requests, Download to sign, Upload signed, for the officer on the signed-in record (President or Vice-president) |
| `people:self`          | My area's fee card: pay, upload the transfer receipt, download one's own signed receipts                                             |

These names are provisional, in the style of the People permissions. Holding `people:receipts:sign` is not enough: the
backend signs only for the person who holds the office (`viewerSigner`), so the queue and the ZIP follow the record,
not the permission.

## Screens

- **Member register**: the Fee column keeps its badge and filter; the row's first action follows the fee (Review
  receipt for Receipt uploaded, Send reminder for Due and Unpaid, an empty slot otherwise, so icons align); Mark as
  paid joins the row's other actions. The page's outline action is Send reminders; Export register is a boxed icon
  button after Add member, in the same place for everyone who can export (one primary and at most one outline per
  header).
- **Review receipt** (lg dialog, bottom sheet on phones): the uploaded file (the shared eSign PDF viewer, an image shown, Open in a new
  tab), the member and fee year, the declared transfer, earlier rejections, and the receipt number approving would
  issue. Reject switches the dialog to a required reason with three one-click starts; Back returns.
- **People › Receipts** (new section, `Receipt` icon, after Member register): fee-year menu, search, a segmented filter
  over the pipeline with totals, and a table (Receipt, Member, Amount, Issued on, Signer, Status). Signers see "n
  receipts are waiting for your signature", Sign with CIE and a signing-options menu; the section shows their count in the panel, like
  Reports › Open. A danger alert leads to Send failed.
- **Upload signed receipts** (lg dialog): one row per file with its receipt (a select to correct the match) and the
  outcome: Signed, Not signed, Needs another signer, No receipt, Duplicate or Already signed. "Send n receipts" sends
  only the Signed ones.
- **Person record**: a Fees and receipts card under Member (the fee status lives there only): the current year, the
  upload or payment, the last rejection and reminder, then every receipt with its PDF.
- **My area**: a Membership fee card under the census: bank details with copy buttons and Upload transfer receipt
  while Due or Unpaid, the rejection reason when there is one, the review state while uploaded, the receipt being
  signed once paid, and the signed receipts to download.

## Receipt PDF

A4, Italian, light only. In agent mode `receipt-files.server.ts` renders it; the backend owns the real one.

- Header: PoliNetwork, legal form, registered address and tax code (placeholders until the backend has them);
  "Ricevuta n. 2026/042" and "Milano, 15 ottobre 2026" on the right.
- Title "Ricevuta di pagamento della quota associativa".
- Ricevuto da: name, tax code (placeholder), member number.
- La somma di: the amount in figures (`€ 10,00`) and in words (`dieci/00 euro`).
- A titolo di: "Quota associativa per l'anno sociale 2026/27", the method (Bonifico bancario / Contanti) and its date.
- A placeholder for the tax note, if one applies.
- Signature space: "Il Presidente" (or "Il Vicepresidente" on the President's own receipt) over a line and the name.
- Footer: association details and "Ricevuta 2026/042 · pagina 1 di 1".

## Agent mode

The sample data adds fee years and receipts from their own seed: a sent 2025/26 receipt for older members, this year's
receipts in payment order with the newest to sign, one Send failed and one Voided. `AGENT_PERSON=P-0007` (default) is
the President, `P-0098` the Vice-president, `P-0045` has a receipt to review and `P-0021` a rejected one. For this manual demo only, a file counts
as signed when it is a `.p7m`, holds a PDF signature dictionary (`/ByteRange`) or has "signed"/"firmata" in its name.

## Integration with eSign

The existing `esign.jobs.create`, job-status polling, cancellation and `/api/esign/agent/…` proxy are reused without
changes to the local agent. `people.receipts.prepareSignatures` (see [`contract.md`](contract.md)) is the backend
bridge. It needs both `people:receipts:sign` and `esign:sign`, plus `admin:access`, but does not grant the general
`esign:requests:manage` permission. The backend must create the association and finish the receipt transaction;
copying files back in a browser callback would lose completion when the page closes.

**Backend implementation remains pending**, together with the rest of the People contract. The dashboard implements
the validated adapter and shared CIE UI, not PDF signing or email delivery. Agent mode deliberately reports that CIE
signing needs the backend; it does not invent eSign request IDs or mark sample receipts signed through the CIE action.
The existing manual demo remains available.

Receipt requests in Signatures carry `peopleReceipt` metadata and a link back to the filtered receipt queue. The backend owns both completion paths; see the matching rules in the two contract documents.
