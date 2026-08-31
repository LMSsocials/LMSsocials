'use client'

import React, { useEffect, useState } from 'react'
import {
  ArrowRight,
  ArrowLeft,
  BadgeCheck,
  Check,
  ChevronDown,
  CircleUserRound,
  Globe2,
  Eye,
  EyeOff,
  Instagram,
  LockKeyhole,
  Mail,
  Menu,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  UserRound,
  X,
  Zap,
} from 'lucide-react'
import { authClient as supabase } from './lib/auth-client'
import Dashboard from './Dashboard'

const services = [
  {
    icon: TrendingUp,
    tag: 'BOOSTING',
    title: 'Social Boosting',
    description: 'Build momentum with reliable engagement made for creators, brands and growing businesses.',
    metric: 'Fast delivery',
    className: 'service-lime',
  },
  {
    icon: CircleUserRound,
    tag: 'ACCOUNTS',
    title: 'Quality Logs',
    description: 'Find carefully sourced digital accounts with clear details and responsive support.',
    metric: 'Verified quality',
    className: 'service-violet',
  },
  {
    icon: Globe2,
    tag: 'GLOBAL',
    title: 'Foreign Numbers',
    description: 'Get access to international numbers across popular regions, ready when you need them.',
    metric: 'Multiple countries',
    className: 'service-orange',
  },
]

const countries = [
  { flag: '🇺🇸', name: 'United States', code: '+1' },
  { flag: '🇬🇧', name: 'United Kingdom', code: '+44' },
  { flag: '🇨🇦', name: 'Canada', code: '+1' },
  { flag: '🇩🇪', name: 'Germany', code: '+49' },
]

function Logo() {
  return (
    <a className="logo" href="#top" aria-label="LMS Socials home">
      <span className="logo-mark"><img src="/assets/lms-logo-clean.png" alt="" /></span>
      <span className="logo-word">SOCIALS</span>
    </a>
  )
}

function AuthPage({ route }) {
  const isSignup = route === '#signup'
  const [showPassword, setShowPassword] = useState(false)
  const [message, setMessage] = useState('')
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)

  const switchMode = (mode) => {
    setMessage('')
    window.location.hash = mode
  }

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setMessage('')
    const formData = new FormData(event.currentTarget)
    const password = formData.get('password')

    try {
      if (isSignup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: formData.get('name') },
            emailRedirectTo: window.location.origin + '/#login',
          },
        })
        if (error) throw error
        if (data.session) {
          window.location.hash = '#account'
        } else {
          setMessage('Account created. Check your email to confirm your address, then sign in.')
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        window.location.hash = '#account'
      }
    } catch (error) {
      setMessage(error.message || 'Authentication failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    if (!email) {
      setMessage('Enter your email address first, then select forgot password.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/#reset-password',
    })
    setLoading(false)
    setMessage(error ? error.message : 'If an account exists for this email, a recovery link has been sent.')
  }

  return (
    <main className="auth-page">
      <nav className="auth-nav shell">
        <Logo />
        <a className="auth-back" href="#top"><ArrowLeft size={16} /> Back to home</a>
      </nav>
      <section className="auth-shell shell">
        <div className="auth-visual">
          <div className="auth-orb auth-orb-one" />
          <div className="auth-orb auth-orb-two" />
          <div className="auth-visual-copy">
            <span className="auth-kicker"><Sparkles size={14} /> LMS SOCIALS</span>
            <h1>{isSignup ? 'Your growth starts here.' : 'Welcome back to your lane.'}</h1>
            <p>{isSignup
              ? 'Create one account to access boosting, quality logs, foreign numbers, and order support.'
              : 'Sign in to manage orders, track delivery, and keep every digital service in one place.'}</p>
          </div>
          <div className="auth-feature feature-boost"><TrendingUp /><span><small>Social boosting</small><strong>Fast delivery</strong></span></div>
          <div className="auth-feature feature-logs"><CircleUserRound /><span><small>Quality logs</small><strong>Verified options</strong></span></div>
          <div className="auth-feature feature-global"><Globe2 /><span><small>Global numbers</small><strong>40+ countries</strong></span></div>
          <div className="auth-proof"><ShieldCheck /><span><strong>Private by design</strong><small>Your details stay protected.</small></span></div>
        </div>

        <div className="auth-form-panel">
          <div className="auth-form-head">
            <span>{isSignup ? 'JOIN LMS SOCIALS' : 'ACCOUNT ACCESS'}</span>
            <h2>{isSignup ? 'Create your account' : 'Sign in to continue'}</h2>
            <p>{isSignup ? 'Already have an account?' : 'New to LMS Socials?'} <button type="button" onClick={() => switchMode(isSignup ? '#login' : '#signup')}>{isSignup ? 'Sign in' : 'Create account'}</button></p>
          </div>

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignup && (
              <label>
                <span>Full name</span>
                <div className="auth-input"><UserRound /><input name="name" type="text" placeholder="Your full name" autoComplete="name" required /></div>
              </label>
            )}
            <label>
              <span>Email address</span>
              <div className="auth-input"><Mail /><input name="email" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></div>
            </label>
            <label>
              <span>Password</span>
              <div className="auth-input"><LockKeyhole /><input name="password" type={showPassword ? 'text' : 'password'} placeholder={isSignup ? 'At least 8 characters' : 'Enter your password'} minLength={8} autoComplete={isSignup ? 'new-password' : 'current-password'} required /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff /> : <Eye />}</button></div>
            </label>
            <div className="auth-options">
              <label className="auth-check"><input type="checkbox" required={isSignup} /><span>{isSignup ? 'I agree to the terms and privacy policy' : 'Remember me'}</span></label>
              {!isSignup && <button type="button" onClick={handlePasswordReset} disabled={loading}>Forgot password?</button>}
            </div>
            <button className="auth-submit" type="submit" disabled={loading}>{loading ? 'Please wait…' : isSignup ? 'Create my account' : 'Sign in'} {!loading && <ArrowRight size={18} />}</button>
            {message && <div className="auth-message"><Check size={16} /> {message}</div>}
          </form>
          <p className="auth-security"><ShieldCheck size={14} /> Secured account access • No hidden steps</p>
        </div>
      </section>
    </main>
  )
}

function ResetPasswordPage() {
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)

  const handleUpdate = async (event) => {
    event.preventDefault()
    const formData = new FormData(event.currentTarget)
    const password = formData.get('password')
    const confirmation = formData.get('confirmation')
    if (password !== confirmation) {
      setMessage('Passwords do not match.')
      return
    }
    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) {
      setMessage(error.message)
    } else {
      setMessage('Password updated. You can now sign in.')
      window.setTimeout(() => { window.location.hash = '#login' }, 1400)
    }
  }

  return (
    <main className="auth-page reset-page">
      <nav className="auth-nav shell"><Logo /><a className="auth-back" href="#login"><ArrowLeft size={16} /> Back to login</a></nav>
      <section className="reset-card">
        <span><LockKeyhole /></span>
        <small>SECURE RECOVERY</small>
        <h1>Choose a new password.</h1>
        <p>Use at least eight characters and keep it different from passwords used elsewhere.</p>
        <form onSubmit={handleUpdate}>
          <div className="auth-input"><LockKeyhole /><input name="password" type="password" placeholder="New password" minLength={8} required /></div>
          <div className="auth-input"><LockKeyhole /><input name="confirmation" type="password" placeholder="Confirm new password" minLength={8} required /></div>
          <button className="auth-submit" disabled={loading}>{loading ? 'Updating…' : 'Update password'} {!loading && <ArrowRight size={18} />}</button>
          {message && <div className="auth-message">{message}</div>}
        </form>
      </section>
    </main>
  )
}

function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [toast, setToast] = useState('')
  const [route, setRoute] = useState('')
  const [session, setSession] = useState(null)
  const [authReady, setAuthReady] = useState(false)

  useEffect(() => {
    setRoute(window.location.hash)
    const handleRoute = () => setRoute(window.location.hash)
    window.addEventListener('hashchange', handleRoute)
    return () => window.removeEventListener('hashchange', handleRoute)
  }, [])

  useEffect(() => {
    if (!supabase) return undefined

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setAuthReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setAuthReady(true)
    })

    return () => subscription.unsubscribe()
  }, [])

  const notify = (message) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 2600)
  }

  const closeMenu = () => setMenuOpen(false)

  useEffect(() => {
    const updateScroll = () => {
      const root = document.documentElement
      const y = window.scrollY
      root.style.setProperty('--phone-shift', y * -0.025 + 'px')
      root.style.setProperty('--art-shift', y * 0.035 + 'px')
      root.style.setProperty('--disc-shift', y * -0.035 + 'px')
      root.style.setProperty('--disc-rotate', -7 + y * 0.004 + 'deg')
      root.style.setProperty('--pill-one-shift', y * -0.07 + 'px')
      root.style.setProperty('--pill-two-shift', y * 0.045 + 'px')
      root.style.setProperty('--pill-three-shift', y * -0.025 + 'px')
    }
    updateScroll()
    window.addEventListener('scroll', updateScroll, { passive: true })
    return () => window.removeEventListener('scroll', updateScroll)
  }, [])

  if (route === '#reset-password') {
    return <ResetPasswordPage />
  }

  const accountPage = route.startsWith('#account/') ? route.slice('#account/'.length) : null

  if (route === '#account' || ['boosting', 'numbers', 'logs'].includes(accountPage)) {
    if (!authReady) return <main className="auth-loading"><Logo /><span>Loading your account…</span></main>
    return session ? <Dashboard route={route} session={session} onSignOut={async () => { await supabase.auth.signOut(); window.location.hash = '#login' }} /> : <AuthPage route="#login" />
  }

  if (route === '#login' || route === '#signup') {
    if (session) return <Dashboard route={route} session={session} onSignOut={async () => { await supabase.auth.signOut(); window.location.hash = '#login' }} />
    return <AuthPage route={route} />
  }

  return (
    <main id="top">
      <nav className="nav shell">
        <Logo />
        <div className={`nav-links ${menuOpen ? 'open' : ''}`}>
          <a href="#services" onClick={closeMenu}>Services</a>
          <a href="#numbers" onClick={closeMenu}>Countries</a>
          <a href="#why-us" onClick={closeMenu}>Why us</a>
          <a href="#support" onClick={closeMenu}>Support</a>
          <a className="nav-cta mobile-cta" href="#signup">Get started <ArrowRight size={16} /></a>
        </div>
        <a className="nav-cta desktop-cta" href="#signup">Get started <ArrowRight size={16} /></a>
        <button className="menu-button" aria-label="Toggle menu" onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X /> : <Menu />}
        </button>
      </nav>

      <section className="hero shell">
        <div className="eyebrow"><span><Sparkles size={14} /></span> Your social growth plug</div>
        <h1>Make your social<br />presence <em>loud.</em></h1>
        <p className="hero-copy">Premium digital services for people who take growth seriously. Powerful boosting, quality logs, and global numbers—all under LMS.</p>
        <div className="hero-actions">
          <a className="button primary" href="#signup">Get started <ArrowRight size={18} /></a>
        </div>
        <div className="trust-row">
          <div><span className="avatars"><i>J</i><i>D</i><i>A</i></span><span><b>2,000+</b> happy customers</span></div>
          <div className="rating"><span>★★★★★</span><b>4.9/5</b> average rating</div>
          <div><ShieldCheck size={19} /><b>Secure</b> & reliable</div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-blob" />
          <img className="hero-person" src="/assets/boosting-hero-v3.png" alt="" />
          <div className="hero-arrow">↗</div>
          <div className="hero-chip chip-boost">
            <span><TrendingUp /></span>
            <div><small>Boosting live</small><strong>+248% reach</strong></div>
          </div>
          <div className="hero-chip chip-logs">
            <span><CircleUserRound /></span>
            <div><small>Quality logs</small><strong>Ready to go</strong></div>
            <BadgeCheck />
          </div>
          <div className="hero-chip chip-number">
            <span className="flag">GB</span>
            <div><small>Foreign numbers</small><strong>40+ countries</strong></div>
            <Globe2 />
          </div>
          <div className="mini-social instagram-bubble"><Instagram /></div>
          <div className="mini-social facebook-bubble">
            <svg viewBox="0 0 24 24" role="img" aria-label="Facebook"><path fill="currentColor" d="M14 8.5V7c0-.8.5-1 1-1h2.8V2.1L14.4 2C10.9 2 9 4.1 9 7.7v.8H6v4.4h3V22h5v-9.1h3.4l.6-4.4H14Z" /></svg>
          </div>
          <div className="orb orb-one" />
          <div className="orb orb-two" />
          <div className="float-card card-growth">
            <span className="mini-icon"><TrendingUp /></span>
            <div><small>Growth this week</small><strong>+248%</strong></div>
            <span className="up">↗ 18.4%</span>
          </div>
          <div className="float-card card-order">
            <span className="status-dot"><Check size={16} /></span>
            <div><strong>Order complete</strong><small>Instagram • 10k followers</small></div>
          </div>
          <div className="social-art-card"><img src="/assets/social-orbit.jpg" alt="" /></div>
          <div className="phone-card">
            <div className="phone-top"><Logo /><span>•••</span></div>
            <div className="phone-balance"><small>Available balance</small><strong>$1,280.50</strong><span>+12.5% this month</span></div>
            <div className="phone-grid">
              <div><TrendingUp /><span>Boost</span></div>
              <div><CircleUserRound /><span>Logs</span></div>
              <div><Globe2 /><span>Numbers</span></div>
            </div>
            <div className="phone-recent"><b>Recent orders</b><span>View all</span></div>
            <div className="phone-order"><Instagram /><div><b>Instagram Boost</b><small>10k followers</small></div><strong>$24.99</strong></div>
            <div className="phone-order"><Globe2 /><div><b>UK Number</b><small>United Kingdom</small></div><strong>$8.50</strong></div>
          </div>
        </div>
      </section>

      <section className="scroll-story" aria-label="LMS Socials experience">
        <div className="story-sticky shell">
          <div className="story-copy">
            <h2>One plug.<br /><em>Every platform.</em></h2>
            <p>Your socials shouldn't sit still. Neither should your website.</p>
          </div>
          <div className="story-orbit" aria-hidden="true">
            <div className="story-disc"><img src="/assets/social-orbit.jpg" alt="" /></div>
            <div className="orbit-pill pill-one">Instagram <span>↗</span></div>
            <div className="orbit-pill pill-two">Facebook <span>+24K</span></div>
            <div className="orbit-pill pill-three">Global reach <Globe2 /></div>
          </div>
        </div>
      </section>

      <section className="services section shell" id="services">
        <div className="section-heading">
          <div><span className="kicker">WHAT WE OFFER</span><h2>One platform.<br /><em>Endless possibilities.</em></h2></div>
          <p>From building your online presence to connecting globally, LMS brings the essentials together—simple, fast, and reliable.</p>
        </div>
        <div className="service-grid">
          {services.map(({ icon: Icon, ...service }, index) => (
            <article className={`service-card ${service.className}`} key={service.title}>
              <div className="service-number">0{index + 1}</div>
              <div className="service-icon"><Icon /></div>
              <span className="service-tag">{service.tag}</span>
              <h3>{service.title}</h3>
              <p>{service.description}</p>
              <div className="service-footer"><span><BadgeCheck size={17} /> {service.metric}</span><button onClick={() => notify(`${service.title} catalogue coming next.`)} aria-label={`View ${service.title}`}><ArrowRight /></button></div>
            </article>
          ))}
        </div>
      </section>

      <section className="numbers section shell" id="numbers">
        <div className="number-panel">
          <div className="number-copy">
            <span className="kicker">GO GLOBAL</span>
            <h2>Your number.<br /><em>Anywhere.</em></h2>
            <p>Connect across borders with reliable international numbers for the regions that matter to you.</p>
            <ul><li><Check /> Instant setup</li><li><Check /> Private & secure</li><li><Check /> Helpful support</li></ul>
            <button className="button light" onClick={() => notify('Country catalogue coming next.')}>Browse all countries <ArrowRight size={18} /></button>
          </div>
          <div className="country-stack">
            {countries.map((country, i) => <div className="country-card" style={{ '--i': i }} key={country.name}><span className="flag">{country.flag}</span><div><b>{country.name}</b><small>Virtual number</small></div><strong>{country.code}</strong><ChevronDown /></div>)}
            <div className="available"><span><i /> Available now</span><b>40+ countries</b></div>
          </div>
        </div>
      </section>

      <section className="why section shell" id="why-us">
        <div className="section-heading centered"><div><span className="kicker">WHY LMS SOCIALS</span><h2>Built for <em>speed.</em><br />Backed by trust.</h2></div></div>
        <div className="reason-grid">
          <div><Zap /><h3>Quick delivery</h3><p>No dragging, no stories. Your order gets moving as soon as it lands.</p></div>
          <div><ShieldCheck /><h3>Quality first</h3><p>We prioritize dependable services and clear product information.</p></div>
          <div><MessageCircle /><h3>Real support</h3><p>Need a hand? Speak to a real person who actually wants to help.</p></div>
          <div><Star /><h3>Made to impress</h3><p>A smooth experience from the first click to your completed order.</p></div>
        </div>
      </section>

      <section className="cta-section shell" id="support">
        <div className="cta-inner">
          <span className="kicker">READY WHEN YOU ARE</span>
          <h2>Pick your lane.<br /><em>Let's get moving.</em></h2>
          <p>Join thousands using LMS Socials to grow faster and connect further.</p>
          <a className="button primary" href="mailto:hello@boostlane.co">Start your first order <ArrowRight size={18} /></a>
        </div>
      </section>

      <footer className="site-footer">
        <div className="footer-main shell">
          <div className="footer-brand">
            <Logo />
            <p>Your reliable plug for social growth, quality digital accounts, and global numbers.</p>
            <a href="mailto:hello@lmssocials.com">hello@lmssocials.com <ArrowRight size={15} /></a>
          </div>
          <div className="footer-column">
            <span>Services</span>
            <a href="#services">Social boosting</a>
            <a href="#services">Quality logs</a>
            <a href="#numbers">Foreign numbers</a>
          </div>
          <div className="footer-column">
            <span>Company</span>
            <a href="#why-us">Why LMS</a>
            <a href="#numbers">Countries</a>
            <a href="#top">Back to top</a>
          </div>
          <div className="footer-promise">
            <ShieldCheck />
            <div><strong>Built around trust.</strong><p>Clear service, secure orders, and real human support.</p></div>
          </div>
        </div>
        <div className="footer-bottom shell">
          <span>© 2026 LMS Socials. All rights reserved.</span>
          <span>Built for growth. Designed for trust.</span>
        </div>
      </footer>
      {toast && <div className="toast"><Check size={17} /> {toast}</div>}
    </main>
  )
}

export default App
