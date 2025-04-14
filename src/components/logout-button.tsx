import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth";
import { LogOut } from "lucide-react";
import { redirect } from "next/navigation";

export function LogoutButton() {
  return (
    <Button
      onClick={async () => {
        await signOut();
        redirect("/login");
      }}
      variant="destructive"
      type="submit"
    >
      <LogOut />
      Logout
    </Button>
  );
}
