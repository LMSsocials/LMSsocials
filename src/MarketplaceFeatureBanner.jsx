'use client'

import Image from 'next/image'
import { ArrowRight, Download, FileText, Layers3, Link2, QrCode, Sparkles, Wifi, Zap } from 'lucide-react'
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
    status: 'Full quality',
  },
  tools: {
    eyebrow: 'TOOLS THAT DELIVER',
    title: 'Better tools. Smoother work.',
    description: 'Browse curated working websites, unlock private access and keep every purchased tool close.',
    action: 'Explore tools',
    targetId: 'tools-catalog',
    DetailIcon: Link2,
    image: toolsBannerImage,
    status: 'Private access',
  },
  esim: {
    eyebrow: 'CONNECTION WITHOUT BORDERS',
    title: 'Stay connected. Wherever you land.',
    description: 'Choose the duration that fits your trip, pay securely and receive your eSIM QR code through our assisted delivery flow.',
    action: 'View eSIM plans',
    targetId: 'esim-catalog',
    MainIcon: Wifi,
    DetailIcon: QrCode,
    status: 'QR delivery',
  },
  format: {
    eyebrow: 'READY-TO-USE RESOURCES',
    title: 'The right format, ready when you are.',
    description: 'Browse practical PDF and text resources, purchase securely and keep every unlocked file in your private library.',
    action: 'Browse formats',
    targetId: 'format-catalog',
    MainIcon: FileText,
    DetailIcon: Download,
    status: 'Instant download',
  },
}

export default function MarketplaceFeatureBanner({ variant }) {
  const item = content[variant]
  const { MainIcon, DetailIcon } = item

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
      {item.image
        ? <div className='marketplace-feature-photo'><Image src={item.image} alt='' sizes='(max-width: 720px) 210px, 260px' /></div>
        : <div className='feature-tile main'><MainIcon /></div>}
      <div className='feature-tile detail'><DetailIcon /></div>
      <div className='feature-live-pill'><i /><span><small>READY NOW</small><b>{item.status}</b></span><Zap /></div>
    </div>
  </section>
}
