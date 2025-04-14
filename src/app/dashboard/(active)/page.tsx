import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getServerSession } from "@/server/auth";
import Link from "next/link";

export default async function AdminHome() {
  const session = await getServerSession()
  return (
    session && (
      <main className="container mx-auto px-4 py-8">
        <h2 className="mb-4 text-3xl font-bold text-accent-foreground">Home</h2>

        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          <Link href="/dashboard/hr">
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>HR</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Manage users, dashboards, memebers.</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/management">
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>Management</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Manage internal settings.</p>
              </CardContent>
            </Card>
          </Link>
          <Link href="/dashboard/website">
            <Card className="transition-colors hover:bg-accent">
              <CardHeader>
                <CardTitle>Website Data</CardTitle>
              </CardHeader>
              <CardContent>
                <p>Manage content of our website pages.</p>
              </CardContent>
            </Card>
          </Link>
        </div>
      </main>
    )
  );
}
