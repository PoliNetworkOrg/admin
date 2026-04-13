"use server"
import { trpc } from "../trpc"

export async function testDb() {
  return trpc.test.dbQuery.query({ dbName: "tg" })
}
