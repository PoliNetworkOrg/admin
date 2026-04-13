import { AUTH_PATH } from "@polinetwork/backend"
import type { NextRequest } from "next/server"
import { NextResponse } from "next/server"
import { env } from "./env"

export const config = {
  matcher: [`${AUTH_PATH}/:path*`],
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith(AUTH_PATH)) {
    return NextResponse.rewrite(new URL(request.nextUrl.pathname + request.nextUrl.search, env.BACKEND_URL))
  }
}
