import type { z } from "zod"

import { createUntypedBackendClient } from "@/server/backend.server"

import {
  type AdmitInput,
  type AdmitResult,
  admitResultSchema,
  type NumberInput,
  numberInputSchema,
  type RegisterInput,
  type SetNumberInput,
  type SetNumberResult,
  setNumberResultSchema,
  type SociList,
  sociListSchema,
  type SocioRecord,
  socioRecordSchema,
  type Unregistered,
  unregisteredSchema,
  type UpdateInput,
} from "./soci.contract"

/** The backend's `soci.members.*` procedures, one method each. */
export type SociApi = {
  list: () => Promise<SociList>
  get: (input: NumberInput) => Promise<SocioRecord>
  unregistered: () => Promise<Unregistered[]>
  admit: (input: AdmitInput) => Promise<AdmitResult>
  register: (input: RegisterInput) => Promise<NumberInput>
  update: (input: UpdateInput) => Promise<void>
  setNumber: (input: SetNumberInput) => Promise<SetNumberResult>
}

/**
 * The backend's `soci.*` procedures. Every response is parsed with the contract's schema: a backend that drifts from
 * the contract fails loudly here, not in a page.
 */
function backendSociApi(accessToken: string | null): SociApi {
  const client = createUntypedBackendClient(accessToken)
  const query = async <T, I>(path: string, input: I, schema: z.ZodType<T>) =>
    schema.parse(await client.query(`soci.members.${path}`, input))
  const mutate = async <T, I>(path: string, input: I, schema: z.ZodType<T>) =>
    schema.parse(await client.mutation(`soci.members.${path}`, input))

  return {
    list: () => query("list", undefined, sociListSchema),
    get: (input) => query("get", input, socioRecordSchema),
    unregistered: () => query("unregistered", undefined, unregisteredSchema.array()),
    admit: (input) => mutate("admit", input, admitResultSchema),
    register: (input) => mutate("register", input, numberInputSchema),
    update: async (input) => {
      await client.mutation("soci.members.update", input)
    },
    setNumber: (input) => mutate("setNumber", input, setNumberResultSchema),
  }
}

type SociContext = { agentMode: boolean; session: { accessToken: string | null } }

/** The Soci API for this request: the sample register in agent mode, the backend otherwise. */
export async function sociApi(context: SociContext): Promise<SociApi> {
  if (context.agentMode) {
    const { fakeSociApi } = await import("./soci.fake.server")
    return fakeSociApi()
  }
  return backendSociApi(context.session.accessToken)
}
