import type { Operation } from "../operation"
import { esignOperations } from "./esign"
import { labelsOperations } from "./labels"
import { microsoft365Operations } from "./microsoft365"
import { overviewOperations } from "./overview"
import { peopleOperations } from "./people"
import { regulationsOperations } from "./regulations"
import { reportsOperations } from "./reports"
import { sociOperations } from "./soci"
import { telegramOperations } from "./telegram"
import { websiteOperations } from "./website"
import { whatsappOperations } from "./whatsapp"

/**
 * Every dashboard operation the admin MCP offers, one per server function. `tests/mcp.test.mjs` fails when a server
 * function is neither here nor in `MCP_EXCLUDED`, so a new dashboard feature reaches the MCP with it.
 */
export const OPERATIONS: readonly Operation[] = [
  ...overviewOperations,
  ...telegramOperations,
  ...whatsappOperations,
  ...labelsOperations,
  ...websiteOperations,
  ...reportsOperations,
  ...microsoft365Operations,
  ...peopleOperations,
  ...sociOperations,
  ...esignOperations,
  ...regulationsOperations,
]

/** Server functions the MCP deliberately leaves out (`file#export`), each with the reason. */
export const MCP_EXCLUDED = {
  "src/features/auth/auth.functions.ts#getSessionState": "Browser session plumbing; whoami describes the MCP caller.",
  "src/features/auth/auth.functions.ts#getDashboardAccess":
    "Browser session plumbing; whoami describes the MCP caller.",
  "src/features/auth/auth.functions.ts#getIdpAccountUrl": "A link for the browser's account menu.",
  "src/features/regulations/regulations-editor.functions.ts#issueCollabTicket":
    "A single-use websocket ticket for the browser's editor; regulations.drafts.readSource, editSource and comments.createOnText ask for one and use it.",
} satisfies Record<string, string>
