import pg from 'pg'

let pool: pg.Pool | null = null

export function getPool(): pg.Pool {
  if (pool) return pool
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is not set')
  pool = new pg.Pool({ connectionString: url, max: 10 })
  return pool
}

export async function query<T = any>(text: string, params: any[] = []): Promise<T[]> {
  const res = await getPool().query(text, params)
  return res.rows as T[]
}
