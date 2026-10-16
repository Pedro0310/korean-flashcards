import { readdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { sql } from '../server/db.ts'

// Applies every .sql file in db/migrations that hasn't been applied yet, in
// filename order. To change the schema, add a new numbered file; never edit
// one that has already run.

const dir = join(import.meta.dirname, 'migrations')

await sql`
  create table if not exists schema_migrations (
    name       text primary key,
    applied_at timestamptz not null default now()
  )
`

const applied = new Set((await sql<{ name: string }[]>`select name from schema_migrations`).map((r) => r.name))
const files = (await readdir(dir)).filter((f) => f.endsWith('.sql')).sort()

let count = 0
for (const name of files) {
  if (applied.has(name)) continue
  const text = await readFile(join(dir, name), 'utf8')
  await sql.begin(async (tx) => {
    await tx.unsafe(text)
    await tx`insert into schema_migrations (name) values (${name})`
  })
  console.log(`applied ${name}`)
  count++
}

console.log(count ? `Done: ${count} migration(s) applied.` : 'Database is up to date.')
await sql.end()
