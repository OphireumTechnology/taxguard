export function filterModelText(text: string): string {
  if (typeof text !== 'string') return '';
  return text.trim();
}
