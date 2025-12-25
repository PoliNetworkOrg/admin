import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { env } from "./env"

export const config = {
  matcher: ["/api/:path*"],
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.rewrite(new URL(request.nextUrl.pathname + request.nextUrl.search, env.BACKEND_URL))
  }
}
