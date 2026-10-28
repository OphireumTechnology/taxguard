export function practiceStoreConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL && process.env.DATABASE_URL.length > 0);
}
