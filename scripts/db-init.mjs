import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'

const __dirname = dirname(fileURLToPath(import.meta.url))
const url = process.env.DATABASE_URL
if (!url) { console.error('DATABASE_URL is not set'); process.exit(1) }

const sql = readFileSync(resolve(__dirname, '..', 'sql', 'schema.sql'), 'utf8')
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(sql)
  console.log('✓ Схема применена')
} finally {
  await client.end()
}
