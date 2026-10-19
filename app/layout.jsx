import '../src/styles.css'
import { DM_Sans, Manrope } from 'next/font/google'

const dmSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-dm-sans',
  display: 'swap',
})

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
  display: 'swap',
})

export const metadata = {
  title: 'LMS Socials — Digital Growth Marketplace',
  description: 'Social boosting, quality logs, and foreign numbers in one marketplace.',
}

export default function RootLayout({ children }) {
  return <html lang='en' className={`${dmSans.variable} ${manrope.variable}`}><body>{children}</body></html>
}
