import { SegmentedControl } from "@/components/primitives"
import { Toolbar } from "@/components/shell"

import { FRESHMAN_TABS, type FreshmanTab } from "./freshman.constants"

export function FreshmanTabs({ tab, onTabChange }: { tab: FreshmanTab; onTabChange: (tab: FreshmanTab) => void }) {
  return (
    <Toolbar
      lead={<SegmentedControl label="Freshman content" items={FRESHMAN_TABS} value={tab} onValueChange={onTabChange} />}
    />
  )
}
