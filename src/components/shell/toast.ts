import { type ExternalToast, toast } from "sonner"

/** `id` turns an earlier toast (a `loading` one) into this one; `duration: Infinity` keeps it until dismissed. */
type AppToastOptions = Pick<ExternalToast, "id" | "duration">

/**
 * Toasts with these durations: success/info 4s, warning 6s, error 8s; loading stays until its `id` gets another
 * toast. They go to the one `Toaster` mounted in the root document. Copy follows the toast formula in docs/design.md:
 * "Group deleted.", "Couldn't delete the group."
 */
export const appToast = {
  success: (message: string, options?: AppToastOptions) => toast.success(message, { duration: 4000, ...options }),
  info: (message: string, options?: AppToastOptions) => toast.info(message, { duration: 4000, ...options }),
  warning: (message: string, options?: AppToastOptions) => toast.warning(message, { duration: 6000, ...options }),
  error: (message: string, options?: AppToastOptions) => toast.error(message, { duration: 8000, ...options }),
  loading: (message: string) => toast.loading(message),
}
