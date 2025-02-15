import { USER_ROLE } from "@/constants";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function IndexPage() {
  const sesh = await auth()
  if (sesh) {
    if (sesh.user.role === USER_ROLE.DISABLED) return redirect("/disabled")
    if (sesh.user.role === USER_ROLE.INACTIVE) return redirect("/inactive")
    return redirect("/dashboard")
  }
  return redirect("/login")
}
