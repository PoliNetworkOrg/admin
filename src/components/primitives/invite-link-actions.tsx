import { CircleCheck, CircleX, Copy, ExternalLink, Link2Off } from "lucide-react"
import { AnimatePresence, motion, type Transition, useReducedMotion } from "motion/react"
import { useEffect, useRef, useState } from "react"

import { appToast } from "@/components/shell/toast"
import { copyText } from "@/lib/clipboard"

import { IconButton } from "./icon-button"

type InviteLinkActionsProps = {
  link: string | null
  /** The group's name, added to the accessible labels ("Open invite link for Analisi 1"). */
  name?: string
}

/** How long the copy button shows its result before returning to the copy icon. */
const RESULT_MS = 1500

const RESULT_ICONS = { idle: Copy, copied: CircleCheck, failed: CircleX }

/** Icon swap: deep scale, fade and a little blur on a bounce-free spring; under reduced motion the icon just changes. */
const swapTransition: Transition = { type: "spring", duration: 0.35, bounce: 0 }
const swapHidden = { scale: 0.3, opacity: 0, filter: "blur(3px)" }
const swapShown = { scale: 1, opacity: 1, filter: "blur(0px)" }

function CopyResultIcon({ state }: { state: keyof typeof RESULT_ICONS }) {
  const reduceMotion = useReducedMotion()
  const Icon = RESULT_ICONS[state]
  return (
    <AnimatePresence initial={false} mode="popLayout">
      <motion.span
        key={state}
        aria-hidden
        className="grid size-4 place-items-center"
        initial={swapHidden}
        animate={swapShown}
        exit={swapHidden}
        transition={reduceMotion ? { duration: 0 } : swapTransition}
      >
        <Icon className="size-4" />
      </motion.span>
    </AnimatePresence>
  )
}

/**
 * Copy and open the group's invite link: two ghost buttons, flush, with 8px before the actions that follow. Copy shows
 * its result in place (circle-check, circle-x) for 1.5s. Without a link, a disabled "Not shared" button (dimmed amber
 * icon) takes Open's place and Copy's slot stays empty, so columns stay aligned.
 */
export function InviteLinkActions({ link, name }: InviteLinkActionsProps) {
  const [result, setResult] = useState<"copied" | "failed" | null>(null)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(timer.current), [])

  async function copy(text: string) {
    let outcome: "copied" | "failed"
    try {
      await copyText(text)
      outcome = "copied"
      appToast.success("Invite link copied.")
    } catch (error) {
      console.error(error)
      outcome = "failed"
      appToast.error("The invite link could not be copied.")
    }
    setResult(outcome)
    window.clearTimeout(timer.current)
    timer.current = window.setTimeout(() => setResult(null), RESULT_MS)
  }

  return (
    <div className="mr-2 flex shrink-0 items-center">
      {link === null ? (
        <>
          <span aria-hidden className="size-9 shrink-0" />
          <IconButton
            label="Not shared"
            ariaLabel={name ? `${name} invite link not shared` : undefined}
            icon={Link2Off}
            // Amber says "missing", dimmed says it can't be pressed.
            iconClassName="text-(--pn-action-amber) opacity-55"
            disabled
            focusableWhenDisabled
          />
        </>
      ) : (
        <>
          <IconButton
            label="Copy invite link"
            ariaLabel={name ? `Copy invite link for ${name}` : undefined}
            icon={Copy}
            // The outgoing icon is lifted out of flow (`popLayout`) and positioned against the button.
            className="relative"
            iconNode={<CopyResultIcon state={result ?? "idle"} />}
            onClick={() => void copy(link)}
          />
          <IconButton
            label="Open invite link"
            ariaLabel={name ? `Open invite link for ${name}` : undefined}
            icon={ExternalLink}
            nativeButton={false}
            render={<a href={link} target="_blank" rel="noreferrer" />}
          />
        </>
      )}
    </div>
  )
}
