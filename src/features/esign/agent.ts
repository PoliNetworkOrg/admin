/** Where PoliNetwork eSign listens on the user's computer (github.com/PoliNetworkOrg/esign). */
export const AGENT_PORT = 47321
export const AGENT_ORIGINS = [`http://127.0.0.1:${AGENT_PORT}`, `http://localhost:${AGENT_PORT}`]

/** Documents one agent window signs with one PIN, at most. */
export const MAX_BATCH = 10

/**
 * Set in localStorage once PoliNetwork eSign has answered in this browser: `{"version": string | null, "at": ISO}`,
 * a null version for agents that don't announce themselves.
 */
export const AGENT_FLAG_KEY = "pn-esign-agent"

/** Starts an installed agent that isn't running. */
export const AGENT_LAUNCH_URL = "polinetwork-esign://open"

export const AGENT_RELEASES_URL = "https://github.com/PoliNetworkOrg/esign/releases/latest"

/** Release assets with stable names, so these links always download the latest version. Linux uses the release page. */
export const AGENT_DOWNLOAD_URLS = {
  macos: `${AGENT_RELEASES_URL}/download/PoliNetwork-eSign-macos.dmg`,
  windows: `${AGENT_RELEASES_URL}/download/PoliNetwork-eSign-windows-amd64.zip`,
} as const

/**
 * The agent's signing page for one or more jobs, signed with one PIN. `origin` is this dashboard, which the agent
 * checks against its allowlist.
 */
export function agentSignUrl(tickets: string[], origin: string) {
  const params = new URLSearchParams({ origin })
  for (const ticket of tickets) params.append("ticket", ticket)
  return `${AGENT_ORIGINS[0]}/sign?${params}`
}

export function isAgentOrigin(origin: string) {
  return AGENT_ORIGINS.includes(origin)
}

/** PoliNetwork eSign's User-Agent: `PoliNetwork-eSign/<version>` (0.2.0 and later). */
const AGENT_USER_AGENT = /^PoliNetwork-eSign\/[0-9A-Za-z.+-]{1,32}$/

/**
 * The User-Agent the agent proxy forwards to the backend, which turns away versions too old to sign. Anything that
 * isn't the agent's own is dropped.
 */
export function agentUserAgent(header: string | null) {
  return header !== null && AGENT_USER_AGENT.test(header) ? header : null
}
