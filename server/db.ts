import postgres from 'postgres'

const raw = process.env.DATABASE_URL
if (!raw) {
  throw new Error('DATABASE_URL is not set. Copy .env.example to .env and fill it in.')
}

// Hosted providers' connection strings (Neon's, for one) end in options meant
// for libpq, like channel_binding. postgres.js would send unknown ones to the
// server as settings, which the server rejects, so they are dropped here.
const parsed = new URL(raw)
parsed.searchParams.delete('channel_binding')
const url = parsed.toString()

const isLocal = ['localhost', '127.0.0.1'].includes(parsed.hostname)

export const sql = postgres(url, {
  // Hosted Postgres providers require TLS; a local install does not offer it.
  ssl: isLocal ? false : 'require',
  // snake_case columns in SQL, camelCase properties in TypeScript.
  transform: postgres.camel,
  onnotice: () => {},
})
