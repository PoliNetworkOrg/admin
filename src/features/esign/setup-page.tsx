import { CreditCard, Download, ExternalLink, MonitorCheck, Nfc, Play } from "lucide-react"
import { type ReactNode, useEffect, useState } from "react"

import { SectionCard } from "@/components/primitives"
import { SegmentedControl } from "@/components/primitives/segmented-control"
import { PageBar, PageContent } from "@/components/shell"
import { Button } from "@/components/ui/button"

import { AGENT_LAUNCH_URL, AGENT_ORIGINS, AGENT_RELEASES_URL } from "./agent"

type Os = "macos" | "windows" | "linux"

const OS_ITEMS: { value: Os; label: string }[] = [
  { value: "macos", label: "macOS" },
  { value: "windows", label: "Windows" },
  { value: "linux", label: "Linux" },
]

const CIE_SOFTWARE = {
  macos: {
    name: "Software CIE (Mac App Store)",
    url: "https://apps.apple.com/it/app/software-cie/id6476510798?mt=12",
    note: "On Apple Silicon Macs it runs through Rosetta; macOS installs Rosetta the first time if needed.",
  },
  windows: {
    name: "CIE ID middleware for Windows",
    url: "https://github.com/italia/cie-middleware/releases/latest",
    note: "Run the installer, then open CIE ID once.",
  },
  linux: {
    name: "CIE ID middleware for Linux (.deb, .rpm)",
    url: "https://github.com/italia/cie-middleware-linux/releases/latest",
    note: (
      <>
        Also set up the smart-card service for your distribution:
        <span className="block">
          Debian/Ubuntu: <code className="font-mono text-[12px]">sudo apt install pcscd</code>
        </span>
        <span className="block">
          Arch: <code className="font-mono text-[12px]">sudo pacman -S pcsclite ccid</code>, then{" "}
          <code className="font-mono text-[12px]">sudo systemctl enable --now pcscd.service</code>. See the{" "}
          <a
            className="text-(--pn-accent) hover:underline"
            href="https://wiki.archlinux.org/title/Smartcards"
            target="_blank"
            rel="noreferrer"
          >
            ArchWiki smart-card guide
          </a>
          .
        </span>
      </>
    ),
  },
} satisfies Record<Os, { name: string; url: string; note: ReactNode }>

const AGENT_STEPS = {
  // Drop the Open Anyway sentence once macOS releases are notarized (docs/esign/TRACKER.md, Code signing).
  macos: (
    <>
      Download the macOS .dmg, open it and double-click <strong>PoliNetwork eSign</strong>. The first time, macOS says
      it can't verify the app: choose Done, open System Settings › Privacy & Security, choose Open Anyway next to the
      message about PoliNetwork eSign, and confirm with your password. It then installs itself and starts whenever you
      log in.
    </>
  ),
  // Drop the Run anyway sentence once Windows releases are signed (docs/esign/TRACKER.md, Code signing).
  windows: (
    <>
      Download the Windows .zip, extract it and double-click <strong>esign.exe</strong>. If Windows says “Windows
      protected your PC”, choose More info, then Run anyway. It then installs itself and starts whenever you log in.
    </>
  ),
  linux: (
    <>
      Download the package for your system and install it: the .pkg.tar.zst with{" "}
      <code className="font-mono text-[12px]">sudo pacman -U</code> on Arch-based systems, the .deb with apt on Debian
      or Ubuntu, the .rpm with dnf on Fedora. It starts whenever you log in.
    </>
  ),
}

function detectOs(): Os {
  const agent = navigator.userAgent
  if (/windows/i.test(agent)) return "windows"
  if (/linux|x11/i.test(agent) && !/android/i.test(agent)) return "linux"
  return "macos"
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

/** How to prepare a computer to sign with the CIE: reader, CIE software, PoliNetwork eSign, a check. */
export function EsignSetupPage() {
  const [os, setOs] = useState<Os>("macos")
  useEffect(() => setOs(detectOs()), [])
  const software = CIE_SOFTWARE[os]

  return (
    <>
      <PageBar
        width="settings"
        description="Prepare this computer once to sign with your CIE"
        left={<SegmentedControl label="Operating system" items={OS_ITEMS} value={os} onValueChange={setOs} />}
      />
      <PageContent width="settings">
        <div className="flex max-w-[760px] flex-col gap-4">
          <Step number={1} icon={Nfc} title="Connect an NFC card reader">
            <p>
              The CIE is contactless: you need a USB NFC reader that works as a standard smart-card reader (PC/SC). If
              you don't have one yet, get one sold as compatible with the CIE 3.0 before the next steps. Phones can't be
              used here.
            </p>
          </Step>
          <Step number={2} icon={CreditCard} title="Install the CIE software">
            <p>
              Install <strong className="text-(--pn-fg)">{software.name}</strong>, then open it and pair your card with
              your 8-digit PIN. {software.note}
            </p>
            <div>
              <Button
                variant="outline"
                size="sm"
                nativeButton={false}
                render={<a href={software.url} target="_blank" rel="noreferrer" />}
              >
                <ExternalLink aria-hidden /> Get the CIE software
              </Button>
            </div>
            <p className="text-[13px]">
              Alternatively PoliNetwork eSign works with the open-source{" "}
              <a
                className="text-(--pn-accent) hover:underline"
                href="https://github.com/M0Rf30/opencie-pkcs11/releases/latest"
                target="_blank"
                rel="noreferrer"
              >
                OpenCIE
              </a>{" "}
              library placed next to it.
            </p>
          </Step>
          <Step number={3} icon={Download} title="Install PoliNetwork eSign">
            <p>{AGENT_STEPS[os]}</p>
            <div>
              <Button
                size="sm"
                nativeButton={false}
                render={<a href={AGENT_RELEASES_URL} target="_blank" rel="noreferrer" />}
              >
                <Download aria-hidden /> Download PoliNetwork eSign
              </Button>
            </div>
            <p className="text-[13px]">
              Your PIN is typed in the PoliNetwork eSign window on this computer and goes only to the card. PoliNetwork
              never receives it.
            </p>
          </Step>
          <Step number={4} icon={MonitorCheck} title="Check that it works">
            <p>
              Put your CIE on the reader and open the PoliNetwork eSign status page: it should show that PoliNetwork
              eSign is running and ready to sign. Then sign a document from Signatures.
            </p>
            {os === "macos" && (
              <p>
                When you sign, macOS may ask whether PoliNetwork eSign can access data from other apps: choose Allow, so
                it can read the card pairing made in Software CIE.
              </p>
            )}
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
            <p className="text-[13px]">Page doesn't open? Start PoliNetwork eSign, then open the status page again.</p>
          </Step>
        </div>
      </PageContent>
    </>
  )
}
