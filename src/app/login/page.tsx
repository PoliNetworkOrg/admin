import { redirect } from "next/navigation";
import { Github } from "./github";
import { getServerSession } from "@/server/auth";
import { getBaseUrl } from "@/lib/utils";
import { WhatIs } from "./what-is";
import { CanIAccess } from "./can-i-access";

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
    <main className="text-accent container mx-auto flex grow flex-col items-center justify-start space-y-6 px-4 py-8">
      <Github callbackURL={callbackURL} />
      <WhatIs />
      <CanIAccess />
    </main>
  );
}
