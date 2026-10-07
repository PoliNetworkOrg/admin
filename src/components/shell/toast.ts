import { toast } from "sonner"

/**
 * Toasts with the durations from docs/design.md §5.7: success/info 4s, warning 6s, error 8s. They go to the one
 * `Toaster` mounted in the root document. Copy follows §8.3: "Group deleted.", "Couldn't delete the group."
 */
export const appToast = {
  success: (message: string) => toast.success(message, { duration: 4000 }),
  info: (message: string) => toast.info(message, { duration: 4000 }),
  warning: (message: string) => toast.warning(message, { duration: 6000 }),
  error: (message: string) => toast.error(message, { duration: 8000 }),
}
