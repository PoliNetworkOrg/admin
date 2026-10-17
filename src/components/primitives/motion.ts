/** Hover/press transition for composed `Button`s (replaces the base `transition-all`); focus is the shell's outline. */
export const buttonMotion =
  "transition-[background-color,color,border-color,box-shadow] duration-120 focus-visible:ring-0"

/** Raised layer surface: popover, menu, select list. */
export const raisedSurface = "bg-(--pn-surface-raised) text-(--pn-fg) shadow-(--pn-shadow-float) ring-0"

/** Popover / menu / list: opacity + scale .97 from the trigger origin, 160ms in, 120ms out, no slide. */
export const floatingMotion =
  "duration-160 ease-(--pn-ease-out) data-open:[--tw-enter-scale:.97]! data-closed:duration-120 data-closed:ease-(--pn-ease-in) data-closed:[--tw-exit-scale:.97]! [--tw-enter-translate-x:0]! [--tw-enter-translate-y:0]! [--tw-exit-translate-x:0]! [--tw-exit-translate-y:0]!"

/** Dialog panel: opacity + scale .97, 200ms in, 150ms out. */
export const dialogMotion =
  "duration-200 ease-(--pn-ease-out) data-open:animate-in data-open:fade-in-0 data-open:[--tw-enter-scale:.97] data-closed:animate-out data-closed:fade-out-0 data-closed:duration-150 data-closed:ease-(--pn-ease-in) data-closed:[--tw-exit-scale:.97]"

/** Dialog backdrop: scrim without blur, paired with the panel timing. */
export const scrimClasses =
  "bg-(--pn-scrim) duration-200 ease-(--pn-ease-out) supports-backdrop-filter:backdrop-blur-none data-closed:duration-150 data-closed:ease-(--pn-ease-in)"
