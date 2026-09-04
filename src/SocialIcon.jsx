import { CircleUserRound, Gamepad2, LayoutGrid, Mail, MessageCircle, Music2, Network, PackageOpen, Phone, Pin, Send } from 'lucide-react'

const brandLogos = {
  Facebook: ['facebook', '1877F2'], Instagram: ['instagram', 'E4405F'], TikTok: ['tiktok', '000000'], Snapchat: ['snapchat', 'FFFC00'],
  TrustPilot: ['trustpilot', '00B67A'], Reddit: ['reddit', 'FF4500'], Gmail: ['gmail', 'EA4335'], YouTube: ['youtube', 'FF0000'],
  'X / Twitter': ['x', '000000'], LinkedIn: ['linkedin', '0A66C2'], GitHub: ['github', '181717'], Discord: ['discord', '5865F2'],
  Pinterest: ['pinterest', 'BD081C'], Telegram: ['telegram', '26A5E4'], WhatsApp: ['whatsapp', '25D366'],
  VPN: ['openvpn', 'EA7E20'],
}

const fallbackIcons = {
  'Google Voice': Phone, Proxy: Network, 'LMS Socials': PackageOpen, All: LayoutGrid,
  TikTok: Music2, Reddit: MessageCircle, Gmail: Mail, 'X / Twitter': Send, Discord: Gamepad2, Pinterest: Pin,
}

function vpnProviderLogo(title) {
  const name = String(title || '').toLowerCase()
  if (name.includes('avast')) return 'https://cdn.simpleicons.org/avast/FF7800'
  if (name.includes('nord')) return 'https://cdn.simpleicons.org/nordvpn/4687FF'
  if (name.includes('pia') || name.includes('private internet')) return 'https://cdn.simpleicons.org/privateinternetaccess/1A6EFF'
  if (name.includes('hma') || name.includes('hide my ass')) return 'https://hidemyass.com/favicon.ico'
  if (name.includes('ip vanish') || name.includes('ipvanish')) return 'https://www.ipvanish.com/wp-content/uploads/2021/09/ipvanish-logo.svg'
  return null
}

export default function SocialIcon({ category, title }) {
  const providerLogo = category === 'VPN' ? vpnProviderLogo(title) : null
  if (providerLogo) return <img className='social-logo' src={providerLogo} alt='' aria-hidden='true' loading='lazy' />
  if (category === 'Proxy') return <img className='social-logo proxy-logo' src='/assets/proxy-logo.jpg' alt='' aria-hidden='true' loading='lazy' />
  const logo = brandLogos[category]
  if (logo) return <img className='social-logo' src={`https://cdn.simpleicons.org/${logo[0]}/${logo[1]}`} alt='' aria-hidden='true' loading='lazy' />
  const Icon = fallbackIcons[category] || CircleUserRound
  return <Icon aria-hidden='true' />
}
