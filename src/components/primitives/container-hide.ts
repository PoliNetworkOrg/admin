/**
 * Static container-query classes so Tailwind can see them; a column's computed threshold rounds up to the next
 * 40px step. They apply from the shell breakpoint only: below it tables become stacked cards that show every column.
 */
const HIDE_BELOW = new Map<number, string>([
  [320, "shell:@max-[320px]:hidden"],
  [360, "shell:@max-[360px]:hidden"],
  [400, "shell:@max-[400px]:hidden"],
  [440, "shell:@max-[440px]:hidden"],
  [480, "shell:@max-[480px]:hidden"],
  [520, "shell:@max-[520px]:hidden"],
  [560, "shell:@max-[560px]:hidden"],
  [600, "shell:@max-[600px]:hidden"],
  [640, "shell:@max-[640px]:hidden"],
  [680, "shell:@max-[680px]:hidden"],
  [720, "shell:@max-[720px]:hidden"],
  [760, "shell:@max-[760px]:hidden"],
  [800, "shell:@max-[800px]:hidden"],
  [840, "shell:@max-[840px]:hidden"],
  [880, "shell:@max-[880px]:hidden"],
  [920, "shell:@max-[920px]:hidden"],
  [960, "shell:@max-[960px]:hidden"],
  [1000, "shell:@max-[1000px]:hidden"],
  [1040, "shell:@max-[1040px]:hidden"],
  [1080, "shell:@max-[1080px]:hidden"],
  [1120, "shell:@max-[1120px]:hidden"],
  [1160, "shell:@max-[1160px]:hidden"],
  [1200, "shell:@max-[1200px]:hidden"],
  [1240, "shell:@max-[1240px]:hidden"],
  [1280, "shell:@max-[1280px]:hidden"],
  [1320, "shell:@max-[1320px]:hidden"],
  [1360, "shell:@max-[1360px]:hidden"],
  [1400, "shell:@max-[1400px]:hidden"],
  [1440, "shell:@max-[1440px]:hidden"],
  [1480, "shell:@max-[1480px]:hidden"],
  [1520, "shell:@max-[1520px]:hidden"],
  [1560, "shell:@max-[1560px]:hidden"],
  [1600, "shell:@max-[1600px]:hidden"],
])

const HIDE_STEP = 40
const HIDE_MIN = 320
const HIDE_MAX = 1600

export function hideBelowClass(threshold: number): string | undefined {
  const step = Math.min(HIDE_MAX, Math.max(HIDE_MIN, Math.ceil(threshold / HIDE_STEP) * HIDE_STEP))
  return HIDE_BELOW.get(step)
}
