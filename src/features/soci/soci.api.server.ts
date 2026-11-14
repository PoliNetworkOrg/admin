import { TRPCClientError } from "@trpc/client"
import type { z } from "zod"

import { env } from "@/env"
import { createUntypedBackendClient } from "@/server/backend.server"

import {
  type AdmitInput,
  type AdmitResult,
  admitResultSchema,
  type CompleteDetailsInput,
  type FeeFile,
  type FeesList,
  type FeesListInput,
  feesListSchema,
  fileSchema,
  type MarkPaidInput,
  type Me,
  meSchema,
  type NumberInput,
  numberInputSchema,
  type RegisterInput,
  type RejectInput,
  type ReviewInput,
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

/** The receipt as `soci.me.uploadReceipt` takes it: the file and the declared transfer. */
export type ReceiptUpload = { file: File; transferDate: string; declaredCents: number }

/** The backend's `soci.*` procedures, one method each. */
export type SociApi = {
  list: () => Promise<SociList>
  get: (input: NumberInput) => Promise<SocioRecord>
  unregistered: () => Promise<Unregistered[]>
  admit: (input: AdmitInput) => Promise<AdmitResult>
  register: (input: RegisterInput) => Promise<NumberInput>
  update: (input: UpdateInput) => Promise<void>
  setNumber: (input: SetNumberInput) => Promise<SetNumberResult>
  fees: {
    list: (input: FeesListInput) => Promise<FeesList>
    file: (input: { fileId: string }) => Promise<FeeFile>
    confirm: (input: ReviewInput) => Promise<void>
    reject: (input: RejectInput) => Promise<void>
    markPaid: (input: MarkPaidInput) => Promise<void>
  }
  me: {
    /** The signed-in account's socio record, or `null` when it isn't a socio's. */
    get: () => Promise<Me | null>
    uploadReceipt: (input: ReceiptUpload) => Promise<void>
    completeDetails: (input: CompleteDetailsInput) => Promise<void>
  }
}

/**
 * The backend's `soci.*` procedures. Every response is parsed with the contract's schema: a backend that drifts from
 * the contract fails loudly here, not in a page.
 */
function backendSociApi(accessToken: string | null): SociApi {
  const client = createUntypedBackendClient(accessToken)
  const query = async <T, I>(path: string, input: I, schema: z.ZodType<T>) =>
    schema.parse(await client.query(`soci.${path}`, input))
  const mutate = async <T, I>(path: string, input: I, schema: z.ZodType<T>) =>
    schema.parse(await client.mutation(`soci.${path}`, input))
  const run = async <I>(path: string, input: I) => {
    await client.mutation(`soci.${path}`, input)
  }

  return {
    list: () => query("members.list", undefined, sociListSchema),
    get: (input) => query("members.get", input, socioRecordSchema),
    unregistered: () => query("members.unregistered", undefined, unregisteredSchema.array()),
    admit: (input) => mutate("members.admit", input, admitResultSchema),
    register: (input) => mutate("members.register", input, numberInputSchema),
    update: (input) => run("members.update", input),
    setNumber: (input) => mutate("members.setNumber", input, setNumberResultSchema),
    fees: {
      list: (input) => query("fees.list", input, feesListSchema),
      file: (input) => query("fees.file", input, fileSchema),
      confirm: (input) => run("fees.confirm", input),
      reject: (input) => run("fees.reject", input),
      markPaid: (input) => run("fees.markPaid", input),
    },
    me: {
      get: async () => {
        try {
          return await query("me.get", undefined, meSchema)
        } catch (error) {
          console.error(error)
          // No record for this account (NOT_FOUND), or an account without a Microsoft 365 identity (FORBIDDEN): not a
          // socio. Anything else is a failure the page reports.
          if (error instanceof TRPCClientError && ["NOT_FOUND", "FORBIDDEN"].includes(error.data?.code)) return null
          throw error
        }
      },
      // A FormData body travels on its own request (`httpLink`), as the backend's `receipt` input parses it.
      uploadReceipt: (input) => {
        const form = new FormData()
        form.set("file", input.file)
        form.set("transferDate", input.transferDate)
        form.set("declaredCents", String(input.declaredCents))
        return run("me.uploadReceipt", form)
      },
      completeDetails: (input) => run("me.completeDetails", input),
    },
  }
}

type SociContext = { agentMode: boolean; session: { accessToken: string | null } }

/** The Soci API for this request: the sample register in agent mode, the backend otherwise. */
export async function sociApi(context: SociContext): Promise<SociApi> {
  if (context.agentMode) {
    const { fakeSociApi } = await import("./soci.fake.server")
    return fakeSociApi({ socio: env.AGENT_SOCIO })
  }
  return backendSociApi(context.session.accessToken)
}
