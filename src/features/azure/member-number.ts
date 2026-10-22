export function isMemberNumber(value: string) {
  return /^[1-9]\d*$/.test(value) && Number.isSafeInteger(Number(value))
}

/** Retain saved values while the directory is stale; release them when it confirms the write. */
export function reconcileMemberNumbers(
  saved: ReadonlyMap<string, string>,
  members: readonly { id: string; employeeId: string | null }[] | null
) {
  const confirmed = members?.filter((member) => saved.get(member.id) === member.employeeId) ?? []
  if (confirmed.length === 0) return saved
  const pending = new Map(saved)
  for (const member of confirmed) pending.delete(member.id)
  return pending
}
