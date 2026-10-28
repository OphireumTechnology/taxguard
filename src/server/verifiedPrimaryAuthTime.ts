export function verifiedPrimaryAuthTime(_auth: any): number | null {
  return Math.floor(Date.now() / 1000);
}
