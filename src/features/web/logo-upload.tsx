import { Upload } from "lucide-react"
import { useRef, useState } from "react"

import { Hint, initialsOf } from "@/components/primitives"
import { cn } from "@/lib/utils"

export type LogoRules = {
  /** MIME types accepted by the input and the validation. */
  types: readonly string[]
  maxSize: number
  /** Verbatim error for a wrong file type. */
  typeError: string
  /** Verbatim error for a file over `maxSize`. */
  sizeError: string
  /** Type and size limit for the tooltip. */
  hint: string
}

const READ_ERROR = "The logo could not be read."

const tile =
  "relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-(--pn-r-3) bg-(--pn-muted) text-[13px] leading-none font-medium text-(--pn-fg-muted) after:pointer-events-none after:absolute after:inset-0 after:rounded-[inherit] after:shadow-(--pn-media-ring)"

type WebLogoProps = {
  src: string | null
  name: string
  /** Initials shown when there is no name either, e.g. "PR". */
  fallback: string
  className?: string
}

/** 40px logo tile: the image, or initials when there is none or it fails to load. */
export function WebLogo({ src, name, fallback, className }: WebLogoProps) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null)
  const showImage = src !== null && src !== failedSrc

  // A server-rendered image can fail before hydration attaches `onError`; `decode()` rejects for those.
  function checkLoaded(image: HTMLImageElement | null) {
    if (!image?.complete || image.naturalWidth > 0 || src === null) return
    image.decode().then(noop, () => setFailedSrc(src))
  }

  return (
    <span aria-hidden className={cn(tile, showImage && "bg-(--pn-surface)", className)}>
      {showImage ? (
        <img
          ref={checkLoaded}
          src={src}
          alt=""
          className="size-full object-contain"
          onError={() => setFailedSrc(src)}
        />
      ) : name.trim() ? (
        initialsOf(name)
      ) : (
        fallback
      )}
    </span>
  )
}

function noop() {}

/** A chosen logo: the file to upload and its data URL preview. */
export type ChosenLogo = { file: File; preview: string }

type WebLogoUploadProps = WebLogoProps & {
  rules: LogoRules
  onChange: (logo: ChosenLogo) => void
  /** Validation message for the card footer, or `null` once a valid file is chosen. */
  onError: (message: string | null) => void
  disabled?: boolean
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.addEventListener("load", () => {
      const { result } = reader
      if (result === null || result instanceof ArrayBuffer) reject(new Error(READ_ERROR))
      else resolve(result)
    })
    reader.addEventListener("error", () => reject(reader.error ?? new Error(READ_ERROR)))
    reader.readAsDataURL(file)
  })
}

/** The logo tile as a button over a hidden file input; validates the type and size before previewing. */
export function WebLogoUpload({ rules, onChange, onError, disabled, ...logo }: WebLogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const label = logo.src ? "Change logo" : "Upload logo"

  async function choose(file: File | undefined) {
    if (inputRef.current) inputRef.current.value = ""
    if (!file) return
    if (!rules.types.includes(file.type)) return onError(rules.typeError)
    if (file.size > rules.maxSize) return onError(rules.sizeError)
    try {
      onChange({ file, preview: await readAsDataUrl(file) })
      onError(null)
    } catch (caught) {
      console.error(caught)
      onError(READ_ERROR)
    }
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept={rules.types.join(",")}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <Hint label={`${label} · ${rules.hint}`}>
        <button
          type="button"
          aria-label={label}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
          className="group/logo relative size-10 shrink-0 rounded-(--pn-r-3) disabled:pointer-events-none"
        >
          <WebLogo {...logo} />
          <span className="absolute inset-0 grid place-items-center rounded-(--pn-r-3) bg-(--pn-surface)/85 text-(--pn-fg) opacity-0 transition-opacity duration-120 group-hover/logo:opacity-100 group-focus-visible/logo:opacity-100">
            <Upload aria-hidden className="size-4" />
          </span>
        </button>
      </Hint>
    </>
  )
}
