import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { getDatabase } from '../../../../lib/mongodb'

export async function POST(request) {
  try {
    const { token, password } = await request.json()
    if (!token || String(password || '').length < 8) return NextResponse.json({ message: 'Use a valid recovery link and a password of at least 8 characters.' }, { status: 400 })
    const tokenHash = crypto.createHash('sha256').update(String(token)).digest('hex')
    const database = await getDatabase()
    const resets = database.collection('password_resets')
    const reset = await resets.findOne({ tokenHash, expiresAt: { $gt: new Date() } })
    if (!reset) return NextResponse.json({ message: 'This recovery link is invalid or has expired.' }, { status: 400 })
    const passwordHash = await bcrypt.hash(password, 12)
    await database.collection('users').updateOne({ _id: reset.userId }, { $set: { passwordHash, updatedAt: new Date() } })
    await resets.deleteMany({ userId: reset.userId })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[auth/reset-password] failed', { message: error.message })
    return NextResponse.json({ message: 'Password update failed. Please try again.' }, { status: 500 })
  }
}