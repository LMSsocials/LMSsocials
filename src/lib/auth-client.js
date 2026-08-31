const listeners = new Set()

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.message || 'Authentication request failed')
  return payload
}

const publish = (event, session) => listeners.forEach((listener) => listener(event, session))
const failure = (error, data) => ({ data, error: error instanceof Error ? error : new Error(String(error)) })

export const authClient = {
  auth: {
    async signUp({ email, password, options }) {
      try {
        const payload = await request('/api/auth/signup', { method: 'POST', body: JSON.stringify({ email, password, name: options?.data?.full_name }) })
        publish('SIGNED_IN', payload.session)
        return { data: payload, error: null }
      } catch (error) { return failure(error, { user: null, session: null }) }
    },
    async signInWithPassword({ email, password }) {
      try {
        const payload = await request('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
        publish('SIGNED_IN', payload.session)
        return { data: payload, error: null }
      } catch (error) { return failure(error, { user: null, session: null }) }
    },
    async signOut() {
      try { await request('/api/auth/logout', { method: 'POST', body: '{}' }); publish('SIGNED_OUT', null); return { error: null } }
      catch (error) { return { error } }
    },
    async getSession() {
      try { const payload = await request('/api/auth/session'); return { data: { session: payload.session }, error: null } }
      catch (error) { return failure(error, { session: null }) }
    },
    onAuthStateChange(callback) {
      listeners.add(callback)
      return { data: { subscription: { unsubscribe: () => listeners.delete(callback) } } }
    },
    async resetPasswordForEmail(email) {
      try { const data = await request('/api/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }); return { data, error: null } }
      catch (error) { return failure(error, {}) }
    },
    async updateUser({ password }) {
      try {
        const token = new URLSearchParams(window.location.search).get('token')
        const data = await request('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ password, token }) })
        return { data, error: null }
      } catch (error) { return failure(error, { user: null }) }
    },
  },
}