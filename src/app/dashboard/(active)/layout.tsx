import { USER_ROLE } from "@/constants";
import { auth } from "@/server/auth";
import { redirect } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/sidebar/admin-sidebar";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (session?.user.role === USER_ROLE.INACTIVE) redirect("/dashboard/inactive");
  if (session?.user.role === USER_ROLE.DISABLED) redirect("/dashboard/disabled");

  return (
    session && (
      <>
        <AdminSidebar user={session.user} />
        <SidebarInset>{children}</SidebarInset>
      </>
    )
  );
}
