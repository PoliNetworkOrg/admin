import {
  type ComponentPropsWithoutRef,
  type ElementType,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  type Ref,
  useCallback,
  useEffect,
  useImperativeHandle,
  useId,
  useRef,
  useState,
} from "react"

import { cn } from "@/lib/utils"

type ScrollMetrics = {
  maxScroll: number
  thumbSize: number
  thumbOffset: number
  trackSize: number
}

type CustomScrollbarProps<E extends ElementType> = {
  as?: E
  /** Sizing and layout classes for the outer grid. */
  className?: string
  /** Classes for the actual scrollable viewport. */
  viewportClassName?: string
  /** Ref to the scrollable element. */
  scrollRef?: Ref<HTMLElement>
  /** Accessible label for the scrollbar control. */
  scrollLabel?: string
  children?: ReactNode
} & Omit<ComponentPropsWithoutRef<E>, "as" | "className" | "children" | "ref">

/** A scroll area with a themed, draggable scrollbar instead of the browser's scrollbar. */
export function CustomScrollbar<E extends ElementType = "div">({
  as,
  className,
  viewportClassName,
  scrollRef,
  scrollLabel,
  children,
  ...props
}: CustomScrollbarProps<E>) {
  // SAFETY: `as` accepts only React element types, and the fallback is a native div.
  const ScrollElement = (as ?? "div") as ElementType
  const localScrollRef = useRef<HTMLElement | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ pointerId: number; startY: number; startScroll: number } | null>(null)
  const generatedId = useId()
  const [metrics, setMetrics] = useState<ScrollMetrics>({ maxScroll: 0, thumbSize: 0, thumbOffset: 0, trackSize: 0 })
  useImperativeHandle(scrollRef, () => {
    const element = localScrollRef.current
    if (!element) throw new Error("Custom scrollbar viewport did not mount.")
    return element
  }, [scrollRef])

  const measure = useCallback(() => {
    const element = localScrollRef.current
    const track = trackRef.current
    if (!element || !track) return

    const maxScroll = Math.max(0, element.scrollHeight - element.clientHeight)
    const trackSize = track.clientHeight
    const thumbSize =
      maxScroll > 0
        ? Math.min(trackSize, Math.max(24, (trackSize * element.clientHeight) / element.scrollHeight))
        : trackSize
    const thumbOffset = maxScroll > 0 ? ((trackSize - thumbSize) * element.scrollTop) / maxScroll : 0
    setMetrics((current) =>
      current.maxScroll === maxScroll &&
      current.thumbSize === thumbSize &&
      current.thumbOffset === thumbOffset &&
      current.trackSize === trackSize
        ? current
        : { maxScroll, thumbSize, thumbOffset, trackSize }
    )
  }, [])

  useEffect(() => {
    const element = localScrollRef.current
    if (!element) return

    let frame = 0
    const scheduleMeasure = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(measure)
    }
    const resizeObserver = new ResizeObserver(scheduleMeasure)
    resizeObserver.observe(element)
    if (element.firstElementChild) resizeObserver.observe(element.firstElementChild)
    const mutationObserver = new MutationObserver(scheduleMeasure)
    mutationObserver.observe(element, { childList: true, subtree: true, characterData: true, attributes: true })
    element.addEventListener("scroll", scheduleMeasure, { passive: true })
    window.addEventListener("resize", scheduleMeasure)
    scheduleMeasure()

    return () => {
      cancelAnimationFrame(frame)
      resizeObserver.disconnect()
      mutationObserver.disconnect()
      element.removeEventListener("scroll", scheduleMeasure)
      window.removeEventListener("resize", scheduleMeasure)
    }
  }, [measure])

  function onTrackPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || metrics.maxScroll === 0) return
    const element = localScrollRef.current
    if (!element) return
    const rect = event.currentTarget.getBoundingClientRect()
    const clickPosition = event.clientY - rect.top
    const targetPosition = Math.max(0, Math.min(metrics.trackSize, clickPosition - metrics.thumbSize / 2))
    const travel = Math.max(1, metrics.trackSize - metrics.thumbSize)
    element.scrollTop = (targetPosition / travel) * metrics.maxScroll
  }

  function onThumbPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (metrics.maxScroll === 0) return
    event.preventDefault()
    event.stopPropagation()
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = {
      pointerId: event.pointerId,
      startY: event.clientY,
      startScroll: localScrollRef.current?.scrollTop ?? 0,
    }
  }

  function onThumbPointerMove(event: PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current
    const element = localScrollRef.current
    if (!drag || drag.pointerId !== event.pointerId || !element) return
    const travel = Math.max(1, metrics.trackSize - metrics.thumbSize)
    element.scrollTop = drag.startScroll + ((event.clientY - drag.startY) / travel) * metrics.maxScroll
  }

  function onThumbPointerEnd(event: PointerEvent<HTMLDivElement>) {
    if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null
  }

  function onScrollbarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const element = localScrollRef.current
    if (!element) return
    const page = Math.max(40, element.clientHeight * 0.9)
    const amount = Math.max(24, element.clientHeight * 0.1)
    let nextPosition: number
    switch (event.key) {
      case "ArrowDown":
        nextPosition = element.scrollTop + amount
        break
      case "ArrowUp":
        nextPosition = element.scrollTop - amount
        break
      case "PageDown":
        nextPosition = element.scrollTop + page
        break
      case "PageUp":
        nextPosition = element.scrollTop - page
        break
      case "Home":
        nextPosition = 0
        break
      case "End":
        nextPosition = metrics.maxScroll
        break
      default:
        return
    }
    event.preventDefault()
    element.scrollTop = nextPosition
  }

  return (
    <div className={cn("custom-scroll-area", className)}>
      <ScrollElement
        {...props}
        id={generatedId}
        ref={localScrollRef}
        className={cn("custom-scroll-area__viewport", viewportClassName)}
      >
        {children}
      </ScrollElement>
      <div
        ref={trackRef}
        role="scrollbar"
        aria-label={scrollLabel ?? "Scroll content"}
        aria-controls={generatedId}
        aria-orientation="vertical"
        aria-valuemin={0}
        aria-valuemax={metrics.maxScroll}
        aria-valuenow={localScrollRef.current?.scrollTop ?? 0}
        tabIndex={metrics.maxScroll > 0 ? 0 : -1}
        onKeyDown={onScrollbarKeyDown}
        onPointerDown={onTrackPointerDown}
        className="custom-scroll-area__track"
        data-visible={metrics.maxScroll > 0 ? "" : undefined}
      >
        <div
          className="custom-scroll-area__thumb"
          style={{
            height: `${metrics.thumbSize}px`,
            transform: `translateY(${metrics.thumbOffset}px)`,
          }}
          onPointerDown={onThumbPointerDown}
          onPointerMove={onThumbPointerMove}
          onPointerUp={onThumbPointerEnd}
          onPointerCancel={onThumbPointerEnd}
          onLostPointerCapture={onThumbPointerEnd}
        />
      </div>
    </div>
  )
}
