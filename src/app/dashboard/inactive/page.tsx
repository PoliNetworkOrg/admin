import { getServerSession } from "@/server/auth";
import Image from "next/image";
import accountSvg from "@/assets/svg/account_inactive.svg";
import { LogoutButton } from "@/components/logout-button";
import { redirect } from "next/navigation";
// import { USER_ROLE } from "@/constants";

export default async function AdminInactive() {
  const { data: session } = await getServerSession();
  if (!session) return redirect("/login");
  // if (session?.user.role !== USER_ROLE.INACTIVE) redirect("/dashboard");
  // TODO

  return (
    session && (
      <main className="container mx-auto flex grow flex-col items-center justify-center px-4 py-8">
        <div className="flex w-full flex-col items-center justify-center space-y-8 py-12 text-center">
          <Image
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            src={accountSvg}
            className="h-auto w-96"
            alt="illustration of account management"
          />
          <h3 className="text-3xl text-accent-foreground">
            Il tuo account deve <br />
            essere abilitato da un dashboard IT
          </h3>
          <p className="max-w-[30rem]">
            Per accedere con GitHub, è necessario che l&apos;account venga
            abilitato da un dashboard IT, in quanto si tratta di una dashboard
            interna di PoliNetwork.
          </p>
          <p className="max-w-[30rem]">
            Se sei già un socio di PoliNetwork, puoi accedere direttamente con
            il tuo indirizzo nome.cognome@polinetwork.org tramite
            &quot;Microsoft Entra ID&quot; e il tuo account sarà automaticamente
            verificato.
          </p>
          <p className="max-w-[30rem]">
            Se sei entrato con il tuo indirizzo nome.cognome@polinetwork.org e
            il tuo account risulta inattivo, potrebbe essere stato disabilitato.
            Contatta un dashboard IT per ottenere più informazioni.
          </p>
        </div>

        <div className="mb-4 flex flex-col items-center justify-between space-y-4 rounded-lg">
          <p>
            <span className="text-accent-foreground">{session.user.name}</span>
            {` <${session.user.email}>`}
          </p>{" "}
          <LogoutButton />
        </div>
      </main>
    )
  );
}
