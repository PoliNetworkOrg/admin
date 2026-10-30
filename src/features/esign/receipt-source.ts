import { receiptRequestSourceSchema } from "../people/people.contract"

/** Older eSign responses have no People association; an advertised association must satisfy the bridge contract. */
export function withReceiptSource<T extends object>(request: T) {
  const source = "peopleReceipt" in request ? request.peopleReceipt : null
  return { ...request, peopleReceipt: receiptRequestSourceSchema.nullish().parse(source) ?? null }
}
