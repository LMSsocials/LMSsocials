'use client'

import { useEffect, useState } from 'react'
import { Clock3, Snowflake } from 'lucide-react'

function timeUntilChristmas() {
  const now = new Date()
  let target = new Date(now.getFullYear(), 11, 25, 0, 0, 0)
  if (now > new Date(now.getFullYear(), 11, 25, 23, 59, 59)) target = new Date(now.getFullYear() + 1, 11, 25, 0, 0, 0)
  const total = Math.max(0, target.getTime() - now.getTime())
  return {
    days: Math.floor(total / 86_400_000),
    hours: Math.floor((total / 3_600_000) % 24),
    minutes: Math.floor((total / 60_000) % 60),
    seconds: Math.floor((total / 1_000) % 60),
    isChristmas: now.getMonth() === 11 && now.getDate() === 25,
  }
}

const emptyCountdown = { days: '--', hours: '--', minutes: '--', seconds: '--', isChristmas: false }

export default function ChristmasCountdown({ variant = 'landing' }) {
  const [countdown, setCountdown] = useState(emptyCountdown)

  useEffect(() => {
    const update = () => setCountdown(timeUntilChristmas())
    update()
    const timer = window.setInterval(update, 1000)
    return () => window.clearInterval(timer)
  }, [])

  const units = [
    ['Days', countdown.days],
    ['Hours', countdown.hours],
    ['Mins', countdown.minutes],
    ['Secs', countdown.seconds],
  ]

  return (
    <section className={`christmas-countdown ${variant}`} aria-label="Countdown to Christmas">
      <div className="countdown-heading">
        <span><Snowflake /> {countdown.isChristmas ? 'Merry Christmas!' : 'Christmas is coming'}</span>
        <small><Clock3 /> December 25</small>
      </div>
      <div className="countdown-units">
        {units.map(([label, value]) => <div key={label}><strong>{String(value).padStart(2, '0')}</strong><span>{label}</span></div>)}
      </div>
    </section>
  )
}
