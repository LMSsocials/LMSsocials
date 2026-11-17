'use client'

import Image from 'next/image'
import { ArrowRight, Layers3, Link2, Sparkles, Zap } from 'lucide-react'
import picturesBannerImage from '../public/assets/working-pictures-banner.jpg'
import toolsBannerImage from '../public/assets/working-tools-banner.jpg'

const content = {
  pictures: {
    eyebrow: 'VISUALS THAT WORK',
    title: 'The right picture changes everything.',
    description: 'Preview polished, ready-to-use visuals and unlock the full-quality file the moment you buy.',
    action: 'Explore pictures',
    targetId: 'pictures-catalog',
    DetailIcon: Layers3,
    image: picturesBannerImage,
  },
  tools: {
    eyebrow: 'TOOLS THAT DELIVER',
    title: 'Better tools. Smoother work.',
    description: 'Browse curated working websites, unlock private access and keep every purchased tool close.',
    action: 'Explore tools',
    targetId: 'tools-catalog',
    DetailIcon: Link2,
    image: toolsBannerImage,
  },
}

export default function MarketplaceFeatureBanner({ variant }) {
  const item = content[variant]
  const { DetailIcon } = item

  return <section className={`marketplace-feature-banner marketplace-feature-${variant}`} aria-label={`${variant} marketplace introduction`}>
    <div className='marketplace-feature-copy'>
      <span><Sparkles /> {item.eyebrow}</span>
      <h2>{item.title}</h2>
      <p>{item.description}</p>
      <button type='button' onClick={() => document.getElementById(item.targetId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>{item.action}<ArrowRight /></button>
    </div>
    <div className='marketplace-feature-art' aria-hidden='true'>
      <i className='feature-orbit orbit-one' /><i className='feature-orbit orbit-two' />
      <span className='feature-spark spark-one' /><span className='feature-spark spark-two' />
      <div className='marketplace-feature-photo'><Image src={item.image} alt='' sizes='(max-width: 720px) 210px, 260px' /></div>
      <div className='feature-tile detail'><DetailIcon /></div>
      <div className='feature-live-pill'><i /><span><small>READY NOW</small><b>{variant === 'pictures' ? 'Full quality' : 'Private access'}</b></span><Zap /></div>
    </div>
  </section>
}
