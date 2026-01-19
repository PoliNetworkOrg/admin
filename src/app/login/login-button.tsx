"use client";
import { Card, CardContent } from "@/components/ui/card";
import { LogInIcon } from "lucide-react";
import Link from "next/link";

export function LoginButton() {
  return (
    <Link href="/login" className="h-20 min-h-20 w-full">
      <Card className="border-primary from-primary to-primary/20 group relative h-full w-full cursor-pointer overflow-hidden bg-linear-to-r to-60%">
        <div className="bg-primary absolute inset-0 opacity-0 transition duration-250 group-hover:opacity-100"></div>
        <CardContent className="text-primary-foreground absolute inset-0 flex items-center space-x-4 py-4">
          <LogInIcon size={32} />
          <p className="flex-1 text-start text-xl">Enter your reserved area</p>
        </CardContent>
      </Card>
    </Link>
  );
}
