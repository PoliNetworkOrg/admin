import { Header } from "@/components/header";
import { SidebarProvider } from "@/components/ui/sidebar";
import { getServerSession } from "@/server/auth";
import { redirect } from "next/navigation";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession();
  // console.log(session)
  if (!session.data) redirect("/login");

  return (
    <div className="flex h-screen w-full flex-col items-center justify-start overflow-y-hidden">
      <Header />
      <SidebarProvider>{children}</SidebarProvider>
    </div>
  );
}
