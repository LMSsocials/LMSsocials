import Image from 'next/image'
import { ArrowRight, BadgeCheck, Sparkles, Zap } from 'lucide-react'

export default function ServicePromoBanner({
  tone,
  image,
  ribbon,
  eyebrow,
  title,
  accent,
  description,
  action,
  targetId,
  proof,
}) {
  return (
    <section className={`service-promo service-promo-${tone}`} aria-label={`${eyebrow} highlight`}>
      <div className='service-promo-ribbon'><Sparkles /><strong>{ribbon}</strong><span><i /> Service is live</span></div>
      <div className='service-promo-card'>
        <div className='service-promo-glow' />
        <div className='service-promo-copy'>
          <span className='service-promo-kicker'><Zap /> {eyebrow}</span>
          <h2>{title}<em>{accent}</em></h2>
          <p>{description}</p>
          <div className='service-promo-actions'>
            <button type='button' onClick={() => document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{action}<ArrowRight /></button>
            <span><BadgeCheck /><small>Trusted flow</small><b>{proof}</b></span>
          </div>
        </div>
        <div className='service-promo-visual' aria-hidden='true'>
          <span className='service-promo-orbit one' /><span className='service-promo-orbit two' />
          <Image src={image} alt='' sizes='(max-width: 720px) 58vw, 440px' />
        </div>
      </div>
    </section>
  )
}
