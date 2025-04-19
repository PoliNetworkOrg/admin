import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: RouteComponent,
})

function RouteComponent() {
  return <div>Hello "/"!</div>
}

//import { getServerSession } from "@/server/auth";
//import { redirect } from "@tanstack/react-router";

//function IndexPage() {
  //const { data: sesh } = await getServerSession();
  //if (!sesh) return redirect({ to: "/login" });
  //
  //return <p>helo</p>
//}
