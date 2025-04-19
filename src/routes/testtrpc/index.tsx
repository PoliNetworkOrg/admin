import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/testtrpc/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/testtrpc/"!</div>
}
