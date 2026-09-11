import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { sendPasswordResetEmail } from '../../../../lib/email'
import { getDatabase } from '../../../../lib/mongodb'

const responseMessage = 'If an account exists for this email, a password-reset link will arrive shortly.'
const resetLifetime = 30 * 60 * 1000
const requestCooldown = 60 * 1000

export async function POST(request) {
  try {
    const { email } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return NextResponse.json({ message: 'Enter a valid email address.' }, { status: 400 })
    if (!process.env.RESEND_API_KEY) {
      console.error('[auth/forgot-password] email delivery is not configured')
      return NextResponse.json({ message: 'Password recovery is temporarily unavailable.' }, { status: 503 })
    }

    const database = await getDatabase()
    const user = await database.collection('users').findOne({ email: normalizedEmail })
    if (!user) return NextResponse.json({ message: responseMessage })

    const resets = database.collection('password_resets')
    const recentRequest = await resets.findOne({ userId: user._id, createdAt: { $gt: new Date(Date.now() - requestCooldown) } })
    if (recentRequest) return NextResponse.json({ message: responseMessage })

    const token = crypto.randomBytes(32).toString('hex')
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
    const now = new Date()
    const expiresAt = new Date(now.getTime() + resetLifetime)
    const siteUrl = String(process.env.AUTH_SITE_URL || new URL(request.url).origin).replace(/\/$/, '')
    const resetUrl = `${siteUrl}/?token=${token}#reset-password`

    await resets.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 })
    await resets.deleteMany({ userId: user._id })
    await resets.insertOne({ userId: user._id, tokenHash, expiresAt, createdAt: now })
    try {
      await sendPasswordResetEmail({ email: normalizedEmail, name: user.name, resetUrl })
    } catch (error) {
      await resets.deleteOne({ tokenHash })
      throw error
    }

    return NextResponse.json({ message: responseMessage })
  } catch (error) {
    console.error('[auth/forgot-password] failed', { message: error.message })
    return NextResponse.json({ message: 'Password recovery is temporarily unavailable. Please try again later.' }, { status: 500 })
  }
}
