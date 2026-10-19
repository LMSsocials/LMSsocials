import '../src/styles.css'
import { DM_Sans, Manrope } from 'next/font/google'
import Script from 'next/script'

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
  return (
    <html lang='en' className={`${dmSans.variable} ${manrope.variable}`}>
      <body>
        {children}
        <noscript>
          <img
            alt=''
            height='1'
            width='1'
            style={{ display: 'none' }}
            src='https://www.facebook.com/tr?id=519872656904192&ev=PageView&noscript=1'
          />
        </noscript>
      </body>
      <Script id='meta-pixel' strategy='afterInteractive'>
        {`!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init','519872656904192');
fbq('track','PageView');`}
      </Script>
    </html>
  )
}
