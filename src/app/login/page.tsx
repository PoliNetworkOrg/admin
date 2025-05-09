import { redirect } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Github } from "./github";
import { getServerSession } from "@/server/auth";
import { getBaseUrl } from "@/lib/utils";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  const callbackURL = `${getBaseUrl()}${callbackUrl ?? "/dashboard"}`;

  const session = await getServerSession();
  if (session.data?.user) redirect("/dashboard");

  return (
    <main className="container mx-auto flex grow flex-col items-center justify-center px-4 py-8 text-accent">
      <Card>
        <CardHeader className="items-center py-8">
          <CardTitle>Login</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6 pb-12">
          <Github callbackURL={callbackURL} />
        </CardContent>
      </Card>
    </main>
  );
}
