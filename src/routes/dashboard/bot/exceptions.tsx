import { createFileRoute } from "@tanstack/react-router"

import { ExceptionsPage } from "@/features/bot/exceptions-page"
import { MOCK_EXCEPTIONS } from "@/features/bot/exceptions.mock"

export const Route = createFileRoute("/dashboard/bot/exceptions")({
  component: () => <ExceptionsPage entries={MOCK_EXCEPTIONS} />,
})
