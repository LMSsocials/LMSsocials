'use client'

import { useEffect, useState } from 'react'
import Image from 'next/image'
import { ArrowLeft, ArrowRight, BadgeCheck, BarChart3, Globe2, Heart, MessageSquareText, ShieldCheck, Sparkles, Smartphone, TrendingUp, Users, Zap } from 'lucide-react'
import logoImage from '../public/assets/lms-logo-clean.png'
import boostHumanImage from '../public/assets/boosting-human-realistic.png'
import numbersHumanImage from '../public/assets/numbers-human-realistic.png'

function ProductVisual({ type }) {
  if (type === 'boost-dashboard') return <div className='product-art product-boost-dashboard'>
    <span className='product-halo one' /><span className='product-halo two' />
    <span className='y2k-spark boost-one' /><span className='y2k-spark boost-two' /><span className='y2k-ring boost-ring' />
    <Image className='product-human product-human-boost' src={boostHumanImage} alt='' sizes='(max-width: 560px) 55vw, 300px' />
    <div className='product-phone'>
      <i className='product-notch' />
      <header><b><Zap /> LMS</b><span><i /> LIVE</span></header>
      <section className='product-balance'><small>Growth wallet</small><strong>Ready to grow</strong><em><TrendingUp /> +12.8%</em></section>
      <div className='product-services'><span><TrendingUp /><b>Boost</b></span><span><Users /><b>Audience</b></span><span><Heart /><b>Engage</b></span></div>
      <div className='product-activity'><small>Campaign activity</small><p><i /><i /><i /><i /><i /><i /></p><b><span /> Order running</b></div>
    </div>
    <div className='y2k-mini-badge boost' aria-hidden='true'><Sparkles /><span>BOOST<br /><b>ONLINE</b></span></div>
  </div>

  if (type === 'boost-metrics') return <div className='product-art product-boost-metrics'>
    <div className='boost-ring-stars' aria-hidden='true'>
      <i className='star one' /><i className='star two' /><i className='star three' /><i className='star four' /><i className='star five' />
      <i className='star six' /><i className='star seven' /><i className='star eight' /><i className='star nine' /><i className='star ten' />
      <i className='star eleven' /><i className='star twelve' /><i className='star thirteen' /><i className='star fourteen' /><i className='star fifteen' /><i className='star sixteen' />
    </div>
    <span className='metric-orbit outer' /><span className='metric-orbit inner' /><i className='metric-core'><TrendingUp /></i>
    <article className='metric-panel followers'><Users /><span><small>AUDIENCE</small><strong>Growing</strong></span><em>+18%</em></article>
    <article className='metric-panel engagement'><Heart /><span><small>ENGAGEMENT</small><strong>Moving</strong></span><em>+24%</em></article>
    <article className='metric-panel reach'><BarChart3 /><span><small>REACH</small><strong>Expanding</strong></span><em>+31%</em></article>
  </div>

  if (type === 'number-inbox') return <div className='product-art product-number-inbox'>
    <div className='number-y2k-orbit' aria-hidden='true'><i /><i /><i /></div>
    <span className='number-y2k-spark large' /><span className='number-y2k-spark small' />
    <div className='network-globe'><Globe2 /><i className='route one' /><i className='route two' /><b className='node one' /><b className='node two' /><b className='node three' /></div>
    <Image className='product-human product-human-numbers' src={numbersHumanImage} alt='' sizes='(max-width: 560px) 55vw, 300px' />
    <div className='product-phone'>
      <i className='product-notch' />
      <header><b><Smartphone /> Numbers</b><span><i /> LIVE</span></header>
      <section className='number-select'><small>Country & service</small><strong><Globe2 /> Global access</strong><span>Supplier ready</span></section>
      <div className='number-message'><MessageSquareText /><span><small>NEW SMS</small><strong>Verification received</strong></span><BadgeCheck /></div>
      <div className='number-safe'><ShieldCheck /><span><b>Private inbox</b><small>Codes stay inside your account</small></span></div>
    </div>
    <div className='number-y2k-status' aria-hidden='true'><MessageSquareText /><span><small>WORLDWIDE SIGNAL</small><b>SMS READY</b></span><i /></div>
  </div>

  return <div className='product-art product-number-network'>
    <div className='number-starfield' aria-hidden='true'>
      <i className='star star-one' /><i className='star star-two' /><i className='star star-three' /><i className='star star-four' /><i className='star star-five' />
      <i className='glint glint-one' /><i className='glint glint-two' /><i className='glint glint-three' />
    </div>
    <div className='network-radar'><Globe2 /><span className='radar-ring one' /><span className='radar-ring two' /><b className='radar-node one' /><b className='radar-node two' /><b className='radar-node three' /></div>
    <article className='network-card top'><Globe2 /><span><small>GLOBAL ROUTE</small><strong>Coverage online</strong></span><i /></article>
    <article className='network-card bottom'><MessageSquareText /><span><small>SMS INBOX</small><strong>Ready for codes</strong></span><ShieldCheck /></article>
  </div>
}

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
  theme = tone,
  artMode = 'cutout',
  secondary,
  visualType,
}) {
  const [activeSlide, setActiveSlide] = useState(0)
  const [paused, setPaused] = useState(false)
  const defaultSpotlight = tone === 'numbers'
    ? { label: 'GLOBAL COVERAGE', title: 'Private inbox ready', note: 'Choose a country. Catch your code.' }
    : { label: 'GROWTH MODE', title: 'Built to stand out', note: 'Pick a service. Set your momentum.' }
  const primary = { image, visualType, eyebrow, title, accent, description, action, targetId, proof, theme, artMode, spotlight: defaultSpotlight }
  const slides = secondary ? [primary, { ...primary, ...secondary }] : [primary]

  useEffect(() => {
    if (paused || slides.length < 2) return undefined
    const timer = window.setInterval(() => setActiveSlide((current) => (current + 1) % slides.length), 6500)
    return () => window.clearInterval(timer)
  }, [paused, slides.length])

  return (
    <section className={`service-promo service-promo-${tone}`} aria-label={`${eyebrow} highlights`} aria-roledescription={slides.length > 1 ? 'carousel' : undefined} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)} onFocusCapture={() => setPaused(true)} onBlurCapture={() => setPaused(false)}>
      <div className='service-promo-ribbon'><Sparkles /><strong>{ribbon}</strong><span><i /> Service is live</span></div>
      <div className='service-promo-stage'>
        <div className='service-promo-track' style={{ transform: `translateX(-${activeSlide * 100}%)` }}>
          {slides.map((slide, index) => <article key={`${slide.theme}-${index}`} className={`service-promo-card service-promo-card-${slide.theme} service-promo-card-${slide.artMode}`} aria-hidden={index !== activeSlide}>
            <div className='service-promo-glow' />
            <div className='service-promo-copy'>
              <span className='service-promo-brand'><Image src={logoImage} alt='' sizes='44px' /><b>LMS SOCIALS</b><small>PREMIUM SERVICES</small></span>
              <span className='service-promo-kicker'><Zap /> {slide.eyebrow}</span>
              <h2>{slide.title}<em>{slide.accent}</em></h2>
              {slide.description && <p>{slide.description}</p>}
              <div className='service-promo-actions'>
                <button type='button' tabIndex={index === activeSlide ? 0 : -1} onClick={() => document.getElementById(slide.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{slide.action}<ArrowRight /></button>
                <span><BadgeCheck /><small>Trusted flow</small><b>{slide.proof}</b></span>
              </div>
            </div>
            <div className='service-promo-visual' aria-hidden='true'>
              <span className='service-promo-orbit one' /><span className='service-promo-orbit two' />
              {slide.visualType ? <ProductVisual type={slide.visualType} /> : <Image src={slide.image} alt='' sizes={slide.artMode === 'cover' ? '(max-width: 720px) 100vw, 1100px' : '(max-width: 720px) 70vw, 480px'} />}
            </div>
            {!slide.visualType && slide.artMode !== 'cover' && <div className='service-promo-float' aria-hidden='true'><span><i /> {slide.spotlight.label}</span><strong>{slide.spotlight.title}</strong><small>{slide.spotlight.note}</small></div>}
            <span className='service-promo-edition' aria-hidden='true'>LMS / 0{index + 1}</span>
          </article>)}
        </div>
        {slides.length > 1 && <>
          <button className='service-promo-arrow previous' type='button' aria-label='Previous promotion' onClick={() => setActiveSlide((current) => (current - 1 + slides.length) % slides.length)}><ArrowLeft /></button>
          <button className='service-promo-arrow next' type='button' aria-label='Next promotion' onClick={() => setActiveSlide((current) => (current + 1) % slides.length)}><ArrowRight /></button>
          <div className='service-promo-dots' role='tablist' aria-label='Choose promotion'>
            {slides.map((slide, index) => <button key={`${slide.theme}-dot-${index}`} type='button' className={index === activeSlide ? 'active' : ''} role='tab' aria-selected={index === activeSlide} aria-label={`Show promotion ${index + 1}`} onClick={() => setActiveSlide(index)} />)}
          </div>
        </>}
      </div>
    </section>
  )
}
