import { redirect } from "next/navigation";
import { SidebarInset } from "@/components/ui/sidebar";
import { AdminSidebar } from "@/components/sidebar/admin-sidebar";
//import { USER_ROLE } from "@/constants";
import { getServerSession } from "@/server/auth";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  // if (session?.user.role === USER_ROLE.INACTIVE) redirect("/dashboard/inactive");
  // if (session?.user.role === USER_ROLE.DISABLED) redirect("/dashboard/disabled");
  if (!session.data) redirect("/login");

  return (
    session && (
      <>
        <AdminSidebar
          user={{
            ...session.data.user,
            ...session.data.session,
          }}
        />
        <SidebarInset>{children}</SidebarInset>
      </>
    )
  );
}
