import bcrypt from 'bcryptjs'
import { NextResponse } from 'next/server'
import { getDatabase } from '../../../../lib/mongodb'
import { createSessionToken, publicUser, sessionCookie } from '../../../../lib/auth'
import { createPocketFiVirtualAccount } from '../../../../lib/pocketfi'

export async function POST(request) {
  try {
    const { email, password, name } = await request.json()
    const normalizedEmail = String(email || '').trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) return NextResponse.json({ message: 'Enter a valid email address.' }, { status: 400 })
    if (String(password || '').length < 8) return NextResponse.json({ message: 'Password must contain at least 8 characters.' }, { status: 400 })
    const database = await getDatabase()
    const users = database.collection('users')
    await users.createIndex({ email: 1 }, { unique: true })
    const cleanName = String(name || '').trim()
    if (!cleanName) return NextResponse.json({ message: 'Enter your full name.' }, { status: 400 })
    if (await users.findOne({ email: normalizedEmail }, { projection: { _id: 1 } })) return NextResponse.json({ message: 'An account with this email already exists.' }, { status: 409 })
    const [passwordHash, pocketfiVirtualAccount] = await Promise.all([
      bcrypt.hash(password, 12),
      createPocketFiVirtualAccount({ name: cleanName, email: normalizedEmail }),
    ])
    const user = { email: normalizedEmail, name: cleanName, passwordHash, balance: 0, balanceKobo: 0, balanceCurrency: 'NGN', pocketfiVirtualAccount, createdAt: new Date(), updatedAt: new Date() }
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