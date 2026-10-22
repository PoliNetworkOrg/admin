/**
 * A link inside a sentence: accent text underlined at rest, so color isn't the only thing that sets it apart, and a
 * full-strength line on hover. Links that stand on their own (a row's title, a card's footer link) keep their style.
 */
export const inlineLink =
  "text-(--pn-accent) underline decoration-(--pn-accent)/40 underline-offset-2 transition-[color,text-decoration-color] duration-120 hover:text-(--pn-accent-hover) hover:decoration-current"
