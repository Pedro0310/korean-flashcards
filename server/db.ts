import postgres from 'postgres'

const url = process.env.DATABASE_URL
if (!url) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

const isLocal = /@(localhost|127\.0\.0\.1)[:/]/.test(url)

export const sql = postgres(url, {
  // Hosted Postgres providers require TLS; a local install does not offer it.
  ssl: isLocal ? false : 'require',
  // snake_case columns in SQL, camelCase properties in TypeScript.
  transform: postgres.camel,
  onnotice: () => {},
})
