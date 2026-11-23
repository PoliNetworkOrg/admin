import { completeMyDetails, getMySocio, uploadMyReceipt } from "@/features/soci/soci-self.functions"
import {
  admitSocio,
  confirmFee,
  markFeePaid,
  registerSocio,
  rejectFee,
  setSocioNumber,
  updateSocio,
} from "@/features/soci/soci-write.functions"
import {
  admitInputSchema,
  completeDetailsInputSchema,
  fileInputSchema,
  markPaidInputSchema,
  numberInputSchema,
  receiptInputSchema,
  registerInputSchema,
  rejectInputSchema,
  reviewInputSchema,
  setNumberInputSchema,
  updateInputSchema,
} from "@/features/soci/soci.contract"
import {
  getFeeFile,
  getFeesToReviewCount,
  getSociFees,
  getSociList,
  getSociRegister,
  getSocio,
  sociFeesInput,
} from "@/features/soci/soci.functions"

import { destructive, read, write } from "../operation"

export const sociOperations = [
  // The Libro Soci.
  read("soci.register.get", getSociRegister, {
    guard: "sociReadMiddleware",
    description:
      "The Libro Soci: every socio by member number, mismatches with the Microsoft 365 Soci group, and its accounts without a record (null if unreadable).",
  }),
  read("soci.socios.list", getSociList, {
    guard: "sociReadMiddleware",
    description: "Every socio record, without the Soci group's unregistered accounts.",
  }),
  read("soci.socios.get", getSocio, {
    guard: "sociReadMiddleware",
    input: numberInputSchema,
    description: "One socio by member number: bookkeeping details, account, admission and end, fees.",
  }),
  destructive("soci.socios.admit", admitSocio, {
    guard: "sociWriteMiddleware",
    input: admitInputSchema,
    description:
      "Admit a new socio: creates a Microsoft 365 account in Soci (licences, member number), emails its credentials to sendEmailTo, then the record. Not undoable here.",
  }),
  write("soci.socios.register", registerSocio, {
    guard: "sociWriteMiddleware",
    input: registerInputSchema,
    description:
      "Record a socio for an account already in Soci (entraObjectId from soci.register.get's unregistered); number only if the account has none.",
  }),
  write("soci.socios.update", updateSocio, {
    guard: "sociWriteMiddleware",
    input: updateInputSchema,
    description: "Edit a socio's bookkeeping details and admission date; empty strings mean unknown.",
  }),
  destructive("soci.socios.setNumber", setSocioNumber, {
    guard: "sociWriteMiddleware",
    input: setNumberInputSchema,
    description:
      "Change a socio's member number on the record and the Microsoft 365 account; the old one is never reused. Optionally emails the new number to notifyEmail.",
  }),

  // Fees.
  read("soci.fees.list", getSociFees, {
    guard: "sociReadMiddleware",
    input: sociFeesInput,
    description:
      "One fee year's fees (current year by default) with totals per status, and the fee years to choose from. Uploaded receipts carry their fileId.",
  }),
  read("soci.fees.toReviewCount", getFeesToReviewCount, {
    guard: "sociReadMiddleware",
    description: "How many transfer receipts wait for review in the current fee year.",
  }),
  read("soci.fees.file", getFeeFile, {
    guard: "sociReadMiddleware",
    input: fileInputSchema,
    description: "An uploaded transfer receipt (fileId from soci.fees.list) as file name, content type and base64.",
  }),
  destructive("soci.fees.confirm", confirmFee, {
    guard: "sociWriteMiddleware",
    input: reviewInputSchema,
    description:
      "Confirm a reviewed receipt (fileId from soci.fees.list): the fee is paid on its transfer date and the socio is emailed. Fails if a newer receipt arrived.",
  }),
  destructive("soci.fees.reject", rejectFee, {
    guard: "sociWriteMiddleware",
    input: rejectInputSchema,
    description:
      "Reject a reviewed receipt: the fee is Due again and the socio gets the reason by email and in My area.",
  }),
  write("soci.fees.markPaid", markFeePaid, {
    guard: "sociWriteMiddleware",
    input: markPaidInputSchema,
    description:
      "Record a fee paid outside the dashboard (transfer or other) on a date; opens the fee year for the socio if needed.",
  }),

  // The caller's own socio record (My area).
  read("soci.me.get", getMySocio, {
    guard: "peopleSelfMiddleware",
    description:
      "The caller's own socio record: details, fields they may complete, this fee year's amount, IBAN and reference, and their fees. null if not a socio.",
  }),
  write("soci.me.uploadReceipt", uploadMyReceipt, {
    guard: "peopleSelfMiddleware",
    input: receiptInputSchema,
    files: [{ field: "file", required: true, description: "The transfer receipt: PDF, JPEG or PNG, at most 10 MB." }],
    description:
      "Upload the caller's transfer receipt for this fee year with the transfer date and amount in cents, replacing one still waiting for review.",
  }),
  destructive("soci.me.completeDetails", completeMyDetails, {
    guard: "peopleSelfMiddleware",
    input: completeDetailsInputSchema,
    description:
      "Fill in the caller's own empty socio fields (see soci.me.get's missing). Once recorded, only the Direttivo can change them.",
  }),
]
