import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { H3Event } from 'h3'
import { query } from './db'
import type { AuthUser } from '~~/shared/types'

export const SESSION_COOKIE = 'mc_session'
const SESSION_TTL_DAYS = 30

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

export function newId(prefix: string): string {
  return prefix + '_' + randomBytes(9).toString('base64url')
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function createSession(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
  await query(
    `INSERT INTO sessions (token, user_id, expires_at) VALUES ($1, $2, $3)`,
    [token, userId, expiresAt]
  )
  return { token, expiresAt }
}

export async function deleteSession(token: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE token = $1`, [token])
}

// Возвращает пользователя по куке сессии, либо null.
export async function getUserFromEvent(event: H3Event): Promise<AuthUser | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const rows = await query<{
    id: string; email: string; login: string; full_name: string; expires_at: Date
  }>(
    `SELECT u.id, u.email, u.login, u.full_name, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1`,
    [token]
  )
  if (!rows.length) return null

  const row = rows[0]
  if (row.expires_at.getTime() < Date.now()) {
    // истёкшая — удаляем и возвращаем null
    await deleteSession(token)
    return null
  }

  return {
    id: row.id,
    email: row.email,
    login: row.login,
    fullName: row.full_name,
  }
}

export function setSessionCookie(event: H3Event, token: string, expiresAt: Date) {
  setCookie(event, SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: expiresAt,
  })
}

export function clearSessionCookie(event: H3Event) {
  setCookie(event, SESSION_COOKIE, '', {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    expires: new Date(0),
  })
}

// Простая валидация полей
export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}
export function validateLogin(login: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(login)
}

export async function getUserById(id: string): Promise<(AuthUser & { passwordHash: string }) | null> {
  const rows = await query<{
    id: string; email: string; login: string; full_name: string; password_hash: string
  }>(
    `SELECT id, email, login, full_name, password_hash FROM users WHERE id = $1`,
    [id]
  )
  if (!rows.length) return null
  const r = rows[0]
  return {
    id: r.id,
    email: r.email,
    login: r.login,
    fullName: r.full_name,
    passwordHash: r.password_hash,
  }
}
