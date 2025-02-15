import { redirect } from "next/navigation";
import { signIn, providerMap, auth } from "@/server/auth";
import { AuthError } from "next-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Image from "next/image";

const SIGNIN_ERROR_URL = "/api/auth/error";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;

  const session = await auth();
  if (session?.user) redirect("/dashboard");

  return (
    <main className="container mx-auto flex grow flex-col items-center justify-center px-4 py-8 text-accent">
      <Card>
        <CardHeader className="items-center py-8">
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pb-12">
          {Object.values(providerMap).map((provider) => (
            <form
              key={provider.id}
              action={async () => {
                "use server";
                try {
                  await signIn(provider.id, {
                    redirectTo: callbackUrl ?? "",
                  });
                } catch (error) {
                  // Signin can fail for a number of reasons, such as the user
                  // not existing, or the user not having the correct role.
                  // In some cases, you may want to redirect to a custom error
                  if (error instanceof AuthError) {
                    return redirect(`${SIGNIN_ERROR_URL}?error=${error.type}`);
                  }

                  // Otherwise if a redirects happens Next.js can handle it
                  // so you can just re-thrown the error and let Next.js handle it.
                  // Docs:
                  // https://nextjs.org/docs/app/api-reference/functions/redirect#server-component
                  throw error;
                }
              }}
            >
              <BasicLoginButton id={provider.id} name={provider.name} />
            </form>
          ))}
        </CardContent>
      </Card>
    </main>
  );
}

function BasicLoginButton({ id, name }: { id: string; name: string }) {
  return (
    <Button
      type="submit"
      variant="outline"
      className="grid w-full min-w-60 grid-cols-[auto_1fr] grid-rows-1 space-x-2 py-6"
    >
      <Image
        className="justify-self-end"
        src={`https://authjs.dev/img/providers/${id}.svg`}
        unoptimized
        alt={`logo of ${name}`}
        width={24}
        height={24}
      />
      <span className="justify-self-start text-accent-foreground">{name}</span>
    </Button>
  );
}

