/**
 * Chunk and citation offsets count Unicode code points (docs/decisions.md D-023),
 * but JavaScript strings index UTF-16 units. Text containing emoji or other
 * astral characters would highlight the wrong passage if sliced natively.
 */

const SURROGATE = /[\uD800-\uDFFF]/

export interface CodepointText {
  length: number
  slice: (start: number, end?: number) => string
}

export function codepointText(text: string): CodepointText {
  if (!SURROGATE.test(text)) {
    return { length: text.length, slice: (start, end) => text.slice(start, end) }
  }
  const points = Array.from(text)
  return { length: points.length, slice: (start, end) => points.slice(start, end).join('') }
}
