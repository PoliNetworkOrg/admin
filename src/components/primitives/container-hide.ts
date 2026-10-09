/**
 * Static container-query classes so Tailwind can see them; a column's computed threshold rounds up to the next
 * 40px step.
 */
const HIDE_BELOW = new Map<number, string>([
  [320, "@max-[320px]:hidden"],
  [360, "@max-[360px]:hidden"],
  [400, "@max-[400px]:hidden"],
  [440, "@max-[440px]:hidden"],
  [480, "@max-[480px]:hidden"],
  [520, "@max-[520px]:hidden"],
  [560, "@max-[560px]:hidden"],
  [600, "@max-[600px]:hidden"],
  [640, "@max-[640px]:hidden"],
  [680, "@max-[680px]:hidden"],
  [720, "@max-[720px]:hidden"],
  [760, "@max-[760px]:hidden"],
  [800, "@max-[800px]:hidden"],
  [840, "@max-[840px]:hidden"],
  [880, "@max-[880px]:hidden"],
  [920, "@max-[920px]:hidden"],
  [960, "@max-[960px]:hidden"],
  [1000, "@max-[1000px]:hidden"],
  [1040, "@max-[1040px]:hidden"],
  [1080, "@max-[1080px]:hidden"],
  [1120, "@max-[1120px]:hidden"],
  [1160, "@max-[1160px]:hidden"],
  [1200, "@max-[1200px]:hidden"],
  [1240, "@max-[1240px]:hidden"],
  [1280, "@max-[1280px]:hidden"],
  [1320, "@max-[1320px]:hidden"],
  [1360, "@max-[1360px]:hidden"],
  [1400, "@max-[1400px]:hidden"],
  [1440, "@max-[1440px]:hidden"],
  [1480, "@max-[1480px]:hidden"],
  [1520, "@max-[1520px]:hidden"],
  [1560, "@max-[1560px]:hidden"],
  [1600, "@max-[1600px]:hidden"],
])

const HIDE_STEP = 40
const HIDE_MIN = 320
const HIDE_MAX = 1600

export function hideBelowClass(threshold: number): string | undefined {
  const step = Math.min(HIDE_MAX, Math.max(HIDE_MIN, Math.ceil(threshold / HIDE_STEP) * HIDE_STEP))
  return HIDE_BELOW.get(step)
}
