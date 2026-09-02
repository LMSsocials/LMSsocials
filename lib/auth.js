import { SignJWT, jwtVerify } from 'jose'

export const SESSION_COOKIE = 'lms_session'
export const SESSION_MAX_AGE = 60 * 60 * 24 * 7

function secret() {
  const value = process.env.AUTH_JWT_SECRET
  if (!value || value.length < 32) throw new Error('AUTH_JWT_SECRET must contain at least 32 characters')
  return new TextEncoder().encode(value)
}

export async function createSessionToken(user) {
  return new SignJWT({ email: user.email, name: user.name || '' })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user._id))
    .setIssuer('lms-socials')
    .setAudience('lms-socials-web')
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret())
}

export async function verifySessionToken(token) {
  if (!token) return null
  try {
    const { payload } = await jwtVerify(token, secret(), { issuer: 'lms-socials', audience: 'lms-socials-web' })
    return payload
  } catch { return null }
}

export function isAdminEmail(email) {
  return String(process.env.ADMIN_EMAILS || '').split(',').map((value) => value.trim().toLowerCase()).filter(Boolean).includes(String(email || '').toLowerCase())
}

export function publicUser(user) {
  return { id: String(user._id), email: user.email, balance: Number(user.balanceKobo || 0) / 100, currency: 'NGN', isAdmin: isAdminEmail(user.email), user_metadata: { full_name: user.name || '' } }
}

export function sessionCookie(token) {
  return { name: SESSION_COOKIE, value: token, httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE }
}