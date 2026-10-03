import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import type { H3Event } from 'h3'
import { query } from './db'
import type { AuthUser } from '~~/shared/types'

// ---------------------------------------------------------------------------
// Пароли
// ---------------------------------------------------------------------------

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10)
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash)
}

// ---------------------------------------------------------------------------
// Сессии
// ---------------------------------------------------------------------------

export const SESSION_COOKIE = 'mc_session'
export const SESSION_TTL_DAYS = 30
const REFRESH_BEFORE_DAYS = 7    // если до истечения меньше этого — продлеваем
const TOUCH_THROTTLE_MIN = 60    // не обновляем last_seen чаще раза в час

export function newId(prefix: string): string {
  return prefix + '_' + randomBytes(9).toString('base64url')
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url')
}

export async function createSession(
  userId: string,
  event?: H3Event,
): Promise<{ token: string; expiresAt: Date }> {
  const token = newSessionToken()
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)

  let userAgent: string | null = null
  let ip: string | null = null
  if (event) {
    userAgent = (getRequestHeader(event, 'user-agent') || '').slice(0, 500) || null
    const fwd = getRequestHeader(event, 'x-forwarded-for') || ''
    const rawIp = fwd.split(',')[0].trim() || getRequestIP(event, { xForwardedFor: true }) || ''
    ip = rawIp ? rawIp.slice(0, 100) : null
  }

  await query(
    `INSERT INTO sessions (token, user_id, user_agent, ip, last_seen_at, expires_at)
     VALUES ($1, $2, $3, $4, now(), $5)`,
    [token, userId, userAgent, ip, expiresAt]
  )
  return { token, expiresAt }
}

export async function deleteSession(token: string): Promise<void> {
  await query(`DELETE FROM sessions WHERE token = $1`, [token])
}

// Продление сессии. Возвращает новый expiresAt, если продлили, иначе null.
export async function touchSession(token: string): Promise<{ newExpiresAt: Date | null }> {
  const rows = await query<{ expires_at: Date; last_seen_at: Date }>(
    `SELECT expires_at, last_seen_at FROM sessions WHERE token = $1`,
    [token]
  )
  if (!rows.length) return { newExpiresAt: null }

  const now = Date.now()
  const exp = rows[0].expires_at.getTime()
  const seen = rows[0].last_seen_at.getTime()
  const refreshWindowMs = REFRESH_BEFORE_DAYS * 24 * 60 * 60 * 1000
  const touchThrottleMs = TOUCH_THROTTLE_MIN * 60 * 1000

  let newExpiresAt: Date | null = null
  if (exp - now <= refreshWindowMs) {
    newExpiresAt = new Date(now + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000)
    await query(
      `UPDATE sessions SET expires_at = $1, last_seen_at = now() WHERE token = $2`,
      [newExpiresAt, token]
    )
  } else if (now - seen > touchThrottleMs) {
    await query(
      `UPDATE sessions SET last_seen_at = now() WHERE token = $1`,
      [token]
    )
  }

  return { newExpiresAt }
}

export interface SessionRow {
  token: string
  user_agent: string | null
  ip: string | null
  created_at: Date
  last_seen_at: Date
  expires_at: Date
}

export async function listSessions(userId: string): Promise<SessionRow[]> {
  return await query<SessionRow>(
    `SELECT token, user_agent, ip, created_at, last_seen_at, expires_at
       FROM sessions
      WHERE user_id = $1 AND expires_at > now()
      ORDER BY last_seen_at DESC`,
    [userId]
  )
}

export async function revokeSession(userId: string, token: string): Promise<void> {
  await query(
    `DELETE FROM sessions WHERE user_id = $1 AND token = $2`,
    [userId, token]
  )
}

export async function revokeAllSessions(userId: string, exceptToken?: string): Promise<number> {
  if (exceptToken) {
    const rows = await query<{ token: string }>(
      `DELETE FROM sessions WHERE user_id = $1 AND token <> $2 RETURNING token`,
      [userId, exceptToken]
    )
    return rows.length
  }
  const rows = await query<{ token: string }>(
    `DELETE FROM sessions WHERE user_id = $1 RETURNING token`,
    [userId]
  )
  return rows.length
}

// ---------------------------------------------------------------------------
// Cookies
// ---------------------------------------------------------------------------

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

export function getSessionTokenFromEvent(event: H3Event): string | null {
  return getCookie(event, SESSION_COOKIE) || null
}

// ---------------------------------------------------------------------------
// Пользователь по сессии
// ---------------------------------------------------------------------------

export async function getUserFromEvent(event: H3Event): Promise<AuthUser | null> {
  const token = getCookie(event, SESSION_COOKIE)
  if (!token) return null

  const rows = await query<{
    id: string
    email: string
    login: string
    full_name: string
    is_admin: boolean
    expires_at: Date
  }>(
    `SELECT u.id, u.email, u.login, u.full_name, u.is_admin, s.expires_at
       FROM sessions s
       JOIN users u ON u.id = s.user_id
      WHERE s.token = $1`,
    [token]
  )
  if (!rows.length) return null

  const row = rows[0]
  if (row.expires_at.getTime() < Date.now()) {
    await deleteSession(token)
    return null
  }

  return {
    id: row.id,
    email: row.email,
    login: row.login,
    fullName: row.full_name,
    isAdmin: !!row.is_admin,
  }
}

export async function getUserById(id: string): Promise<(AuthUser & { passwordHash: string }) | null> {
  const rows = await query<{
    id: string
    email: string
    login: string
    full_name: string
    password_hash: string
    is_admin: boolean
  }>(
    `SELECT id, email, login, full_name, password_hash, is_admin FROM users WHERE id = $1`,
    [id]
  )
  if (!rows.length) return null
  const r = rows[0]
  return {
    id: r.id,
    email: r.email,
    login: r.login,
    fullName: r.full_name,
    isAdmin: !!r.is_admin,
    passwordHash: r.password_hash,
  }
}

// ---------------------------------------------------------------------------
// Гварды
// ---------------------------------------------------------------------------

export async function requireUser(event: H3Event): Promise<AuthUser> {
  const me = await getUserFromEvent(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'нужно войти' })
  return me
}

export async function requireAdmin(event: H3Event): Promise<AuthUser> {
  const me = await getUserFromEvent(event)
  if (!me) throw createError({ statusCode: 401, statusMessage: 'нужно войти' })
  if (!me.isAdmin) throw createError({ statusCode: 403, statusMessage: 'требуются права администратора' })
  return me
}

// ---------------------------------------------------------------------------
// Валидация
// ---------------------------------------------------------------------------

export function validateEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

export function validateLogin(login: string): boolean {
  return /^[a-zA-Z0-9_.-]{3,32}$/.test(login)
}
