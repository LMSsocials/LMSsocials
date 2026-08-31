import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { getDatabase } from '../../../../lib/mongodb'
import { createSessionToken, publicUser, sessionCookie } from '../../../../lib/auth'

export async function POST(request) {
  try {
    const { email, password } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    const database = await getDatabase()
    const user = await database.collection('users').findOne({ email: normalizedEmail })
    if (!user?.passwordHash || !await bcrypt.compare(String(password || ''), user.passwordHash)) return NextResponse.json({ message: 'Invalid email or password.' }, { status: 401 })
    const token = await createSessionToken(user)
    const session = { user: publicUser(user) }
    const response = NextResponse.json({ user: session.user, session })
    response.cookies.set(sessionCookie(token))
    return response
  } catch (error) {
    console.error('[auth/login] failed', { message: error.message })
    return NextResponse.json({ message: 'Sign in is temporarily unavailable.' }, { status: 500 })
  }
}