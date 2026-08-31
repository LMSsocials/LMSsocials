import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { getDatabase } from '../../../../lib/mongodb'
import { createSessionToken, publicUser, sessionCookie } from '../../../../lib/auth'

export async function POST(request) {
  try {
    const { email, password, name } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return NextResponse.json({ message: 'Enter a valid email address.' }, { status: 400 })
    if (String(password || '').length < 8) return NextResponse.json({ message: 'Password must contain at least 8 characters.' }, { status: 400 })
    const database = await getDatabase()
    const users = database.collection('users')
    await users.createIndex({ email: 1 }, { unique: true })
    const passwordHash = await bcrypt.hash(password, 12)
    const user = { email: normalizedEmail, name: String(name || '').trim(), passwordHash, balance: 0, balanceKobo: 0, balanceCurrency: 'NGN', createdAt: new Date(), updatedAt: new Date() }
    const result = await users.insertOne(user)
    user._id = result.insertedId
    const token = await createSessionToken(user)
    const session = { user: publicUser(user) }
    const response = NextResponse.json({ user: session.user, session }, { status: 201 })
    response.cookies.set(sessionCookie(token))
    return response
  } catch (error) {
    if (error?.code === 11000) return NextResponse.json({ message: 'An account with this email already exists.' }, { status: 409 })
    console.error('[auth/signup] failed', { message: error.message })
    return NextResponse.json({ message: 'Account creation failed. Please try again.' }, { status: 500 })
  }
}