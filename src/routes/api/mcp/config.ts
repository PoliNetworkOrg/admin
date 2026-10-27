import { createFileRoute } from "@tanstack/react-router"

import { mcpPublicConfig } from "@/server/mcp-config"

export const Route = createFileRoute("/api/mcp/config")({
  server: {
    handlers: {
      GET: () => {
        try {
          return Response.json(mcpPublicConfig(process.env), { headers: { "cache-control": "no-store" } })
        } catch (error) {
          console.error(error)
          return Response.json(
            { error: "The admin MCP OAuth client has not been configured." },
            { status: 503, headers: { "cache-control": "no-store" } }
          )
        }
      },
    },
  },
})
