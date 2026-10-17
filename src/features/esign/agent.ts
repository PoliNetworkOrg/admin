/** Where the PoliNetwork Sign Agent listens on the user's computer (github.com/PoliNetworkOrg/sign-agent). */
export const AGENT_PORT = 47321
export const AGENT_ORIGINS = [`http://127.0.0.1:${AGENT_PORT}`, `http://localhost:${AGENT_PORT}`]

/** Starts an installed agent that isn't running. */
export const AGENT_LAUNCH_URL = "polinetwork-sign://open"

export const AGENT_RELEASES_URL = "https://github.com/PoliNetworkOrg/sign-agent/releases/latest"

/** The agent's signing page for a job. `origin` is this dashboard, which the agent checks against its allowlist. */
export function agentSignUrl(ticket: string, origin: string) {
  const params = new URLSearchParams({ ticket, origin })
  return `${AGENT_ORIGINS[0]}/sign?${params}`
}

export function isAgentOrigin(origin: string) {
  return AGENT_ORIGINS.includes(origin)
}
