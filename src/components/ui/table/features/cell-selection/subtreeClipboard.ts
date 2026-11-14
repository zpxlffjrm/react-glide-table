/**
 * Subtree copy (Ctrl/Cmd+Shift+C) encodes tree depth as leading tabs. Plain
 * text can't tell that apart from a spreadsheet row whose first column is
 * blank, so the table remembers the last subtree text it wrote and only reads
 * leading tabs as depth when that exact text is pasted back.
 */

let lastSubtreeCopy: string | null = null

function normalize(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/\n+$/, "")
}

export function rememberSubtreeCopy(text: string): void {
  lastSubtreeCopy = normalize(text)
}

export function isOwnSubtreeCopy(text: string): boolean {
  return lastSubtreeCopy !== null && normalize(text) === lastSubtreeCopy
}
