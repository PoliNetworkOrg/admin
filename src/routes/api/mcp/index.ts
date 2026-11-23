import { createFileRoute } from "@tanstack/react-router"

export const Route = createFileRoute("/api/mcp/")({
  server: {
    handlers: {
      ANY: async ({ request }) => {
        const { handleMcpRequest } = await import("@/mcp/http.server")
        return handleMcpRequest(request)
      },
    },
  },
})
