import { Copy, Download, Info } from "lucide-react"
import { type ReactNode, useCallback, useEffect, useState } from "react"
import { z } from "zod"

import { buttonMotion, CopyableText, IconButton, InlineAlert, SectionCard } from "@/components/primitives"
import { SegmentedControl } from "@/components/primitives/segmented-control"
import { appToast } from "@/components/shell/toast"
import { Button } from "@/components/ui/button"
import { copyText } from "@/lib/clipboard"
import { setupCommands } from "@/mcp/client/commands"
import { MCP_CONFIG_PATH, MCP_DOWNLOAD_PATH, mcpConfigSchema } from "@/mcp/protocol"

type Client = "claude" | "codex" | "antigravity"

const CLIENTS: { value: Client; label: string }[] = [
  { value: "claude", label: "Claude Code" },
  { value: "codex", label: "Codex" },
  { value: "antigravity", label: "Antigravity" },
]

const HINTS = {
  claude: "Run in a terminal.",
  codex: "Run in a terminal, or add the server to ~/.codex/config.toml.",
  antigravity: "Add to mcp_config.json (MCP servers › Manage › View raw config).",
} satisfies Record<Client, string>

const manifestSchema = mcpConfigSchema.extend({ download: z.url() })

type Setup =
  | { status: "loading" }
  | { status: "ready"; origin: string; sha256: string | null }
  | { status: "disabled" }
  | { status: "failed" }

/** The admin's MCP manifest (503 until the public client is registered) and the download's checksum. */
async function loadSetup(): Promise<Setup> {
  const response = await fetch(MCP_CONFIG_PATH, { cache: "no-store" })
  if (response.status === 503) return { status: "disabled" }
  if (!response.ok) throw new Error(`${MCP_CONFIG_PATH} answered HTTP ${response.status}.`)
  const { download } = manifestSchema.parse(await response.json())
  const checksum = await fetch(`${MCP_DOWNLOAD_PATH}.sha256`, { cache: "no-store" })
  const sha256 = checksum.ok ? (/^[0-9a-f]{64}/.exec(await checksum.text())?.[0] ?? null) : null
  return { status: "ready", origin: new URL(download).origin, sha256 }
}

function Snippet({ text, what }: { text: string; what: string }) {
  async function copy() {
    try {
      await copyText(text)
      appToast.success(`${what} copied.`)
    } catch (error) {
      console.error(error)
      appToast.error(`The ${what.toLocaleLowerCase()} could not be copied.`)
    }
  }

  return (
    <div className="flex items-start gap-1 rounded-(--pn-r-3) border border-(--pn-line) bg-(--pn-muted) py-1 pr-1 pl-3">
      <pre className="min-w-0 flex-1 overflow-x-auto py-1.5 font-mono text-xs leading-5 text-(--pn-fg)">{text}</pre>
      <IconButton icon={Copy} label={`Copy ${what.toLocaleLowerCase()}`} onClick={() => void copy()} />
    </div>
  )
}

function Step({ number, title, children }: { number: number; title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm leading-5 font-medium text-(--pn-fg)">
        <span className="mr-2 font-mono text-(--pn-fg-muted) tabular-nums">{number}</span>
        {title}
      </p>
      {children}
    </div>
  )
}

/**
 * Account › AI agents: the downloadable stdio MCP and how to connect Claude Code, Codex or Antigravity to it. Whatever
 * the agent does runs with this account's own dashboard permissions.
 */
export function McpCard() {
  const [setup, setSetup] = useState<Setup>({ status: "loading" })
  const [client, setClient] = useState<Client>("claude")

  const load = useCallback(() => {
    setSetup({ status: "loading" })
    loadSetup().then(setSetup, (error: Error) => {
      console.error(error)
      setSetup({ status: "failed" })
    })
  }, [])
  useEffect(load, [load])

  if (setup.status === "loading") return null
  const commands = setup.status === "ready" ? setupCommands(setup.origin) : null

  return (
    <SectionCard
      title="AI agents"
      padding="settings"
      action={
        commands && (
          <Button
            variant="outline"
            size="sm"
            className={buttonMotion}
            nativeButton={false}
            render={<a href={MCP_DOWNLOAD_PATH} download />}
          >
            <Download aria-hidden data-icon="inline-start" />
            Download
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-5">
        <p className="text-sm text-pretty text-(--pn-fg-muted)">
          Let an AI agent on your computer use the dashboard as you, with exactly your permissions: they are reloaded
          every 5 minutes, or at once when the agent asks. Requires Node.js 22 or newer.
        </p>
        {setup.status === "disabled" && (
          <InlineAlert tone="neutral">
            Not enabled on this server yet: an administrator must register the MCP’s sign-in client.
          </InlineAlert>
        )}
        {setup.status === "failed" && (
          <InlineAlert
            action={
              <Button variant="outline" size="sm" onClick={load}>
                Retry
              </Button>
            }
          >
            The AI agent setup could not be loaded.
          </InlineAlert>
        )}
        {commands && (
          <>
            <Step number={1} title="Install and sign in">
              <Snippet text={commands.install} what="Install commands" />
              {setup.status === "ready" && setup.sha256 && (
                <div className="flex min-w-0 items-center gap-2 text-xs text-(--pn-fg-muted)">
                  <span className="shrink-0">SHA-256</span>
                  <CopyableText value={setup.sha256} what="SHA-256" className="min-w-0 font-mono" />
                </div>
              )}
            </Step>
            <Step number={2} title="Add it to your agent">
              <SegmentedControl label="AI agent" items={CLIENTS} value={client} onValueChange={setClient} />
              <Snippet text={commands[client]} what={client === "antigravity" ? "Configuration" : "Command"} />
              <p className="text-xs text-(--pn-fg-muted)">{HINTS[client]}</p>
            </Step>
            <p className="flex items-start gap-1.5 text-xs text-(--pn-fg-muted)">
              <Info aria-hidden className="mt-px size-3.5 shrink-0" />
              On Windows, use the absolute command that polinetwork-admin-mcp status prints.
            </p>
          </>
        )}
      </div>
    </SectionCard>
  )
}
