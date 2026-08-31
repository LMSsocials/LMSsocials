import crypto from 'node:crypto'
import { NextResponse } from 'next/server'
import { getDatabase } from '../../../../lib/mongodb'

export async function POST(request) {
  try {
    const { email } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const database = await getDatabase()
    const user = await database.collection('users').findOne({ email: normalizedEmail })
    let resetPath
    if (user) {
      const token = crypto.randomBytes(32).toString('hex')
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')
      await database.collection('password_resets').deleteMany({ userId: user._id })
      await database.collection('password_resets').insertOne({ userId: user._id, tokenHash, expiresAt: new Date(Date.now() + 30 * 60 * 1000), createdAt: new Date() })
      if (process.env.NODE_ENV !== 'production') resetPath = `/?token=${token}#reset-password`
    }
    return NextResponse.json({ message: 'If an account exists for this email, password-reset instructions will be sent.', resetPath })
  } catch (error) {
    console.error('[auth/forgot-password] failed', { message: error.message })
    return NextResponse.json({ message: 'Password recovery is temporarily unavailable.' }, { status: 500 })
  }
}