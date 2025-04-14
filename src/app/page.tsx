import { getServerSession } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function IndexPage() {
  const { data: sesh } = await getServerSession();
  return redirect(sesh ? "/dashboard" : "/login");
}
