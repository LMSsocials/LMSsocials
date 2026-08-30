const USERS_KEY = 'lms-demo-users'
const SESSION_KEY = 'lms-demo-session'
const listeners = new Set()

const read = (key, fallback) => {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback } catch { return fallback }
}

const write = (key, value) => localStorage.setItem(key, JSON.stringify(value))

const hashPassword = async (password) => {
  const bytes = new TextEncoder().encode(password)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')
}

const publicUser = (user) => ({
  id: user.id,
  email: user.email,
  user_metadata: user.user_metadata,
})

const currentSession = () => {
  const session = read(SESSION_KEY, null)
  if (!session?.user?.id || !session.user.email) {
    localStorage.removeItem(SESSION_KEY)
    return null
  }
  return { ...session, user: publicUser(session.user) }
}

const publish = (event, session) => {
  listeners.forEach((listener) => listener(event, session))
}

const authError = (message) => ({ data: { user: null, session: null }, error: new Error(message) })

export const localAuth = {
  async signUp({ email, password, options }) {
    const normalizedEmail = email.trim().toLowerCase()
    const users = read(USERS_KEY, [])
    if (users.some((user) => user.email === normalizedEmail)) {
      return authError('An account with this email already exists.')
    }

    const user = {
      id: crypto.randomUUID(),
      email: normalizedEmail,
      passwordHash: await hashPassword(password),
      user_metadata: options?.data || {},
    }
    users.push(user)
    write(USERS_KEY, users)
    const session = { access_token: crypto.randomUUID(), user }
    write(SESSION_KEY, session)
    const safeSession = currentSession()
    publish('SIGNED_IN', safeSession)
    return { data: { user: publicUser(user), session: safeSession }, error: null }
  },

  async signInWithPassword({ email, password }) {
    const users = read(USERS_KEY, [])
    const user = users.find((item) => item.email === email.trim().toLowerCase())
    if (!user || user.passwordHash !== await hashPassword(password)) {
      return authError('Invalid email or password.')
    }
    write(SESSION_KEY, { access_token: crypto.randomUUID(), user })
    const session = currentSession()
    publish('SIGNED_IN', session)
    return { data: { user: publicUser(user), session }, error: null }
  },

  async signOut() {
    localStorage.removeItem(SESSION_KEY)
    publish('SIGNED_OUT', null)
    return { error: null }
  },

  async getSession() {
    return { data: { session: currentSession() }, error: null }
  },

  onAuthStateChange(callback) {
    listeners.add(callback)
    return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
  },

  async resetPasswordForEmail(email) {
    const exists = read(USERS_KEY, []).some((user) => user.email === email.trim().toLowerCase())
    return { data: {}, error: exists ? null : new Error('No demo account uses this email.') }
  },

  async updateUser({ password }) {
    const session = read(SESSION_KEY, null)
    if (!session) return { data: { user: null }, error: new Error('Sign in before changing your password.') }
    const users = read(USERS_KEY, [])
    const user = users.find((item) => item.id === session.user.id)
    if (!user) return { data: { user: null }, error: new Error('Demo account not found.') }
    user.passwordHash = await hashPassword(password)
    write(USERS_KEY, users)
    write(SESSION_KEY, { ...session, user })
    return { data: { user: publicUser(user) }, error: null }
  },
}
