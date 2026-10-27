import { z } from "zod"

/** Shared email validation for Azure member notifications. */
export const azureEmailSchema = z.email()
