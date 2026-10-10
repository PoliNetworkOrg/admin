export type DeviceKind = "desktop" | "phone" | "tablet"

export type SessionDevice = { name: string; kind: DeviceKind }

// Order matters: Edge and Opera also send `Chrome/`, and Chrome also sends `Safari/`.
const browsers: [name: string, pattern: RegExp][] = [
  ["Edge", /Edg(?:e|A|iOS)?\//],
  ["Opera", /OPR\/|Opera/],
  ["Firefox", /Firefox\/|FxiOS\//],
  ["Chrome", /Chrome\/|CriOS\//],
  ["Safari", /Version\/.*Safari\//],
]

const systems: [name: string, pattern: RegExp][] = [
  ["iPadOS", /iPad/],
  ["iOS", /iPhone|iPod/],
  ["Android", /Android/],
  ["ChromeOS", /CrOS/],
  ["Windows", /Windows/],
  ["macOS", /Macintosh|Mac OS X/],
  ["Linux", /Linux/],
]

function find(list: [string, RegExp][], userAgent: string) {
  return list.find(([, pattern]) => pattern.test(userAgent))?.[0]
}

/** "Chrome on Linux" from a raw user agent; falls back to the raw string when neither part is recognised. */
export function sessionDevice(userAgent: string | null | undefined): SessionDevice {
  if (!userAgent) return { name: "Unknown device", kind: "desktop" }
  const browser = find(browsers, userAgent)
  const system = find(systems, userAgent)
  const kind: DeviceKind =
    /iPad/.test(userAgent) || (/Android/.test(userAgent) && !/Mobile/.test(userAgent))
      ? "tablet"
      : /iPhone|iPod|Mobile/.test(userAgent)
        ? "phone"
        : "desktop"
  const name = browser && system ? `${browser} on ${system}` : (browser ?? system ?? userAgent)
  return { name, kind }
}
