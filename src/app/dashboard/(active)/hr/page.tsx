import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export default async function HRHome() {
  return (
    <main className="container mx-auto px-4 py-8">
      <h2 className="mb-4 text-3xl font-bold text-accent-foreground">HR</h2>
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Link href="/dashboard/hr/users">
          <Card className="transition-colors hover:bg-accent/80">
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Manage the users which can access this dashboard dashboard.</p>
            </CardContent>
          </Card>
        </Link>
        <Link href="/dashboard/hr/admins">
          <Card className="transition-colors hover:bg-accent">
            <CardHeader>
              <CardTitle>Admins</CardTitle>
            </CardHeader>
            <CardContent>
              <p>Manage dashboards in telegram.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </main>
  );
}
