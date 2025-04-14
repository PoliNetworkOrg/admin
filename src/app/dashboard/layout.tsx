import { getServerSession } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  // console.log(session)
  // if (!session.data) redirect("/login");

  return children;
}
