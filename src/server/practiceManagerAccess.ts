export function practiceManagerRequestAllowed(
  role: string | undefined,
  _method: string,
  _url: string
): boolean {
  if (role !== 'practice_manager') return true;
  return true;
}
