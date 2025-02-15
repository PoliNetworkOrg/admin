import { Button } from "@/components/ui/button";
import { auth, signOut } from "@/server/auth";
import { LogOut } from "lucide-react";
import Image from "next/image";
import accountSvg from "@/assets/svg/account_disabled.svg";
import { USER_ROLE } from "@/constants";
import { redirect } from "next/navigation";

async function logout() {
  "use server";

  await signOut({
    redirect: true,
    redirectTo: "/",
  });
}

export default async function AdminInactive() {
  const session = await auth();
  if (session?.user.role !== USER_ROLE.DISABLED) redirect("/dashboard");
  return (
    session && (
      <main className="container mx-auto flex grow flex-col items-center justify-center px-4 py-8">
        <div className="flex w-full flex-col items-center justify-center space-y-8 py-12 text-center">
          <Image
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            src={accountSvg}
            className="h-auto w-96"
            alt="illustration of disabled account"
          />
          <h3 className="text-3xl text-accent-foreground">
            Il tuo account è stato disabilitato
            <br />
          </h3>
          <p className="max-w-[30rem]">
            Il tuo account è stato disabilitato in quanto non sei un membro
            riconosciuto di PoliNetwork.
          </p>
          <p className="max-w-[30rem]">
            Se credi che sia un errore, manda una richiesta di rivalutazione.
          </p>
        </div>

        <form
          action={logout}
          className="mb-4 flex flex-col items-center justify-between space-y-4 rounded-lg"
        >
          <p>
            <span className="text-accent-foreground">{session.user.name}</span>
            {` <${session.user.email}>`}
          </p>{" "}
          <Button variant="destructive" type="submit">
            <LogOut />
            Logout
          </Button>
        </form>
      </main>
    )
  );
}
