import { HocuspocusProvider } from "@hocuspocus/provider"
import { useServerFn } from "@tanstack/react-start"
import { useEffect, useRef, useState } from "react"
import * as Y from "yjs"
import { z } from "zod"

import { issueCollabTicket } from "../regulations-editor.functions"

/**
 * The draft's collaborative document, from the collab service (Hocuspocus). Each connection needs a fresh,
 * single-use ticket from the backend, through the dashboard's server: the browser never holds an IdP token. The
 * document maps every source path to its `Y.Text` (`files`).
 */

export type CollabStatus = "connecting" | "connected" | "disconnected" | "failed"

export type Peer = { clientId: number; name: string; color: string; self: boolean }

/** Server notices: a compile finished or started, or the draft changed state (frozen, unfrozen). */
const collabMessageSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("compile"), hash: z.string().nullish(), state: z.string() }),
  z.object({ type: z.literal("state"), state: z.string().optional() }),
])
export type CollabMessage = z.infer<typeof collabMessageSchema>

/** What each client publishes about itself (y-codemirror.next reads `user` for remote cursors). */
const peerStateSchema = z.object({ user: z.object({ name: z.string().min(1), color: z.string().optional() }) })

type Session = { document: Y.Doc; provider: HocuspocusProvider; readOnly: boolean }

/** Collaborator colors: theme tokens, so cursors read in both themes. */
const COLORS = [
  "var(--pn-accent-solid)",
  "var(--pn-success-solid)",
  "var(--pn-warning-solid)",
  "var(--pn-danger-solid)",
  "var(--pn-info-fg)",
  "var(--pn-fg-muted)",
]

export function colorFor(seed: string) {
  let hash = 0
  for (const char of seed) hash = (hash * 31 + char.charCodeAt(0)) | 0
  return COLORS[Math.abs(hash) % COLORS.length]
}

export function useCollab({
  draftId,
  state,
  user,
  onMessage,
}: {
  draftId: string
  /**
   * The draft's state. A new state (frozen, unfrozen) means a new document and connection: a Y.Doc that typed while
   * the server had made its connection read-only can't be reused, so it is destroyed, never kept.
   */
  state: string
  user: { name: string; email: string }
  onMessage: (message: CollabMessage) => void
}) {
  const issue = useServerFn(issueCollabTicket)
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<CollabStatus>("connecting")
  const [synced, setSynced] = useState(false)
  const [files, setFiles] = useState<string[]>([])
  const [peers, setPeers] = useState<Peer[]>([])
  /** Bumped to reconnect from scratch with a new ticket, e.g. after the draft froze. */
  const [generation, setGeneration] = useState(0)
  const handler = useRef(onMessage)
  useEffect(() => {
    handler.current = onMessage
  })

  useEffect(() => {
    let cancelled = false
    let provider: HocuspocusProvider | null = null
    const document = new Y.Doc()
    const map = document.getMap<Y.Text>("files")
    const readFiles = () => setFiles([...map.keys()].sort((a, b) => a.localeCompare(b)))
    map.observe(readFiles)
    setStatus("connecting")
    setSynced(false)
    setSession(null)

    issue({ data: { draftId } }).then(
      (first) => {
        if (cancelled) return
        // The first ticket opens the first connection; every reconnection asks for its own.
        let spare: string | null = first.ticket
        provider = new HocuspocusProvider({
          url: first.url,
          name: first.documentName,
          document,
          token: async () => {
            if (spare) {
              const ticket = spare
              spare = null
              return ticket
            }
            return (await issue({ data: { draftId } })).ticket
          },
          onStatus: ({ status: next }) =>
            setStatus(next === "connected" ? "connected" : next === "connecting" ? "connecting" : "disconnected"),
          onSynced: ({ state }) => {
            setSynced(state)
            readFiles()
          },
          onAuthenticationFailed: ({ reason }) => {
            console.error(new Error(`Collab authentication failed: ${reason}`))
            setStatus("failed")
          },
          onStateless: ({ payload }) => {
            try {
              const parsed = collabMessageSchema.safeParse(JSON.parse(payload))
              if (!parsed.success) return
              const message = parsed.data
              if (message.type === "state") setGeneration((value) => value + 1)
              handler.current(message)
            } catch (error) {
              console.error(error)
            }
          },
        })
        const awareness = provider.awareness
        if (awareness) {
          const color = colorFor(user.email || user.name)
          awareness.setLocalStateField("user", {
            name: user.name,
            color,
            colorLight: `color-mix(in oklab, ${color} 22%, transparent)`,
          })
          const readPeers = () =>
            setPeers(
              [...awareness.getStates()].flatMap(([clientId, state]) => {
                const parsed = peerStateSchema.safeParse(state)
                if (!parsed.success) return []
                const peer = parsed.data.user
                return [
                  { clientId, name: peer.name, color: peer.color ?? COLORS[0], self: clientId === document.clientID },
                ]
              })
            )
          awareness.on("change", readPeers)
          readPeers()
        }
        setSession({ document, provider, readOnly: first.readOnly })
      },
      (error) => {
        console.error(error)
        if (!cancelled) setStatus("failed")
      }
    )

    return () => {
      cancelled = true
      map.unobserve(readFiles)
      provider?.destroy()
      document.destroy()
    }
  }, [draftId, state, generation, issue, user.email, user.name])

  return {
    document: session?.document ?? null,
    provider: session?.provider ?? null,
    readOnly: session?.readOnly ?? true,
    status,
    synced,
    files,
    peers,
    reconnect: () => setGeneration((value) => value + 1),
  }
}
