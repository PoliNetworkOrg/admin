import { CreditCard, Download, ExternalLink, MonitorCheck, Nfc, Play } from "lucide-react"
import { type ReactNode, useState } from "react"

import { InlineAlert, inlineLink, SectionCard } from "@/components/primitives"
import { SegmentedControl } from "@/components/primitives/segmented-control"
import { PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { computerOnly, phoneOnly } from "./action-card"
import { AGENT_DOWNLOAD_URLS, AGENT_LAUNCH_URL, AGENT_ORIGINS, AGENT_RELEASES_URL } from "./agent"
import { type Os, useComputerOs, useSigningDevice } from "./signing-device"

const OS_NAMES = { macos: "macOS", windows: "Windows", linux: "Linux" } satisfies Record<Os, string>

const OS_ITEMS: { value: Os; label: string }[] = (["macos", "windows", "linux"] as const).map((value) => ({
  value,
  label: OS_NAMES[value],
}))

const CIE_ID = {
  macos: {
    url: "https://apps.apple.com/it/app/software-cie/id6476510798?mt=12",
    install: (
      <>
        Install <strong className="text-(--pn-fg)">CIE ID</strong> (“Software CIE” on the Mac App Store) and open it. On
        Apple silicon, install Rosetta when macOS asks.
      </>
    ),
  },
  windows: {
    url: "https://github.com/italia/cie-middleware/releases/latest",
    install: (
      <>
        Install <strong className="text-(--pn-fg)">CIE ID</strong> and open it.
      </>
    ),
  },
  linux: {
    url: "https://github.com/italia/cie-middleware-linux/releases/latest",
    install: (
      <>
        Install <strong className="text-(--pn-fg)">CIE ID</strong> (.deb or .rpm) and open it.
      </>
    ),
  },
} satisfies Record<Os, { url: string; install: ReactNode }>

const code = "font-mono text-[12px]"

const AGENT_STEPS = {
  // Drop the Open Anyway sentence once macOS releases are notarized (docs/esign/TRACKER.md, Code signing).
  macos: (
    <>
      Open the downloaded .dmg and double-click <strong className="text-(--pn-fg)">PoliNetwork eSign</strong>. The first
      time, macOS says it can't verify the app: choose Done, then Open Anyway in System Settings › Privacy & Security,
      and confirm with your password. It then installs itself and starts at login.
    </>
  ),
  // Drop the Run anyway sentence once Windows releases are signed (docs/esign/TRACKER.md, Code signing).
  windows: (
    <>
      Extract the downloaded .zip and double-click <strong className="text-(--pn-fg)">esign.exe</strong>. If Windows
      says “Windows protected your PC”, choose More info, then Run anyway. It then installs itself and starts at login.
    </>
  ),
  linux: (
    <>
      Install the package for your system: the .pkg.tar.zst with <code className={code}>sudo pacman -U</code> on
      Arch-based systems, the .deb with apt on Debian or Ubuntu, the .rpm with dnf on Fedora. It starts at login.
    </>
  ),
}

function Step({
  number,
  icon: Icon,
  title,
  children,
}: {
  number: number
  icon: typeof Nfc
  title: string
  children: ReactNode
}) {
  return (
    <SectionCard>
      <div className="flex gap-4">
        <span className="grid size-10 shrink-0 place-items-center rounded-(--pn-r-4) bg-(--pn-accent-soft) text-(--pn-accent)">
          <Icon aria-hidden className="size-5" />
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <h2 className="text-[15px] font-semibold">
            <span className="text-(--pn-fg-muted) tabular-nums">{number}. </span>
            {title}
          </h2>
          <div className="flex flex-col gap-2 text-[14px] text-pretty text-(--pn-fg-muted)">{children}</div>
        </div>
      </div>
    </SectionCard>
  )
}

function PairStep({ os }: { os: Os }) {
  return (
    <Step number={2} icon={CreditCard} title="Pair your card in CIE ID">
      <p>{CIE_ID[os].install} Then pair your card with its 8-digit PIN: if it pairs there, signing works here too.</p>
      <div>
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={CIE_ID[os].url} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink aria-hidden /> Get CIE ID
        </Button>
      </div>
      {os === "linux" && (
        <>
          <p>
            CIE ID also needs your distribution's smart-card service:
            <span className="block">
              Debian/Ubuntu: <code className={code}>sudo apt install pcscd</code>
            </span>
            <span className="block">
              Arch: <code className={code}>sudo pacman -S pcsclite ccid</code>, then{" "}
              <code className={code}>sudo systemctl enable --now pcscd.service</code>. See the{" "}
              <a
                className={inlineLink}
                href="https://wiki.archlinux.org/title/Smartcards"
                target="_blank"
                rel="noreferrer"
              >
                ArchWiki smart-card guide
              </a>
              .
            </span>
          </p>
          <p className="text-[13px]">
            PoliNetwork eSign also works with the open-source{" "}
            <a
              className={inlineLink}
              href="https://github.com/M0Rf30/opencie-pkcs11/releases/latest"
              target="_blank"
              rel="noreferrer"
            >
              OpenCIE
            </a>{" "}
            library placed next to it.
          </p>
        </>
      )}
      <p className="text-[13px]">
        Card won't pair? Write to{" "}
        <a className={inlineLink} href="mailto:it@polinetwork.org">
          it@polinetwork.org
        </a>
        .
      </p>
    </Step>
  )
}

/**
 * The download comes first on every system: the instructions start from the downloaded file. On a phone, reading the
 * steps for a computer, it is a plain link rather than the page's primary.
 */
function InstallStep({ os, here }: { os: Os; here: boolean }) {
  if (os === "linux") {
    return (
      <Step number={3} icon={Download} title="Install PoliNetwork eSign">
        <div>
          <Button
            size="sm"
            variant={here ? "default" : "outline"}
            nativeButton={false}
            render={<a href={AGENT_RELEASES_URL} target="_blank" rel="noreferrer" />}
          >
            <Download aria-hidden /> Download PoliNetwork eSign
          </Button>
        </div>
        <p>{AGENT_STEPS.linux}</p>
      </Step>
    )
  }
  return (
    <Step number={3} icon={Download} title="Install PoliNetwork eSign">
      <div className="flex flex-col items-start gap-1">
        {/* Same tab: the release asset downloads without leaving the page. */}
        <Button
          size="sm"
          variant={here ? "default" : "outline"}
          nativeButton={false}
          render={<a href={AGENT_DOWNLOAD_URLS[os]} />}
        >
          <Download aria-hidden /> Download for {OS_NAMES[os]}
        </Button>
        <a
          className="inline-flex min-h-8 items-center text-[13px] text-(--pn-accent) hover:underline"
          href={AGENT_RELEASES_URL}
          target="_blank"
          rel="noreferrer"
        >
          Other systems and versions
        </a>
      </div>
      <p>{AGENT_STEPS[os]}</p>
      <p className="text-[13px]">Already installed? Download and open it again: it replaces the old version.</p>
    </Step>
  )
}

function CheckStep({ os }: { os: Os }) {
  return (
    <Step number={4} icon={MonitorCheck} title="Check that it works">
      <p>
        Put your CIE on the reader and open the status page: it should show that PoliNetwork eSign is running and ready
        to sign.
        {os === "macos" &&
          " When you sign, macOS may ask whether PoliNetwork eSign can access data from other apps: choose Allow, so it can use the pairing made in CIE ID."}
      </p>
      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          nativeButton={false}
          render={<a href={`${AGENT_ORIGINS[0]}/`} target="_blank" rel="noreferrer" />}
        >
          <ExternalLink aria-hidden /> Open the status page
        </Button>
        <Button variant="outline" size="sm" nativeButton={false} render={<a href={AGENT_LAUNCH_URL} />}>
          <Play aria-hidden /> Start PoliNetwork eSign
        </Button>
      </div>
    </Step>
  )
}

function ComputerSteps({ os, here }: { os: Os; here: boolean }) {
  return (
    <>
      <PairStep os={os} />
      <InstallStep os={os} here={here} />
      <CheckStep os={os} />
    </>
  )
}

/** On a phone or tablet: where to go, and how to read the steps here meanwhile. */
function PhoneNote({ picked, className }: { picked: boolean; className?: string }) {
  return (
    <div className={className}>
      <InlineAlert tone="info">
        Open this page on the computer you will sign with.{!picked && " Or choose its system above to read the steps."}
      </InlineAlert>
    </div>
  )
}

/**
 * How to prepare a computer to sign with the CIE: reader, CIE ID, PoliNetwork eSign, a check. Phones and tablets get
 * no system preselected: the steps after the reader happen on the computer. Before hydration a Mac may be an iPad, so
 * both renders come from the server and CSS shows the one for the screen.
 */
export function EsignSetupPage() {
  const device = useSigningDevice()
  const detected = useComputerOs()
  const [picked, setPicked] = useState<Os | null>(null)
  const os = picked ?? detected
  const unknown = device === "unknown" && picked === null
  const control = (value: Os | null) => (
    <SegmentedControl label="Operating system" items={OS_ITEMS} value={value} onValueChange={setPicked} />
  )
  const reader = (
    <Step number={1} icon={Nfc} title="Connect an NFC card reader">
      <p>
        The CIE is contactless: you need a USB NFC reader that works as a standard smart-card reader (PC/SC), sold as
        compatible with the CIE 3.0. A phone can't take its place.
      </p>
    </Step>
  )

  return (
    <>
      <PageBar
        width="settings"
        description="Prepare your computer once to sign with your CIE"
        left={
          unknown ? (
            <>
              <div className={computerOnly}>{control(os)}</div>
              <div className={phoneOnly}>{control(null)}</div>
            </>
          ) : (
            control(os)
          )
        }
      />
      <PageContent width="settings">
        <div className="flex max-w-[760px] flex-col gap-4">
          {unknown ? (
            <>
              <PhoneNote picked={false} className={phoneOnly} />
              {reader}
              {os && (
                <div className={cn("flex flex-col gap-4", computerOnly)}>
                  <ComputerSteps os={os} here />
                </div>
              )}
            </>
          ) : (
            <>
              {!detected && <PhoneNote picked={picked !== null} />}
              {reader}
              {os && <ComputerSteps os={os} here={detected !== null} />}
            </>
          )}
        </div>
      </PageContent>
    </>
  )
}
