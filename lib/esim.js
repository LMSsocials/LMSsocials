export const ESIM_PLANS = Object.freeze([
  { id: '1-month', months: 1, name: '1 Month', description: 'Short-term eSIM access for one month.', priceKobo: 1850000 },
  { id: '3-months', months: 3, name: '3 Months', description: 'Extended eSIM access for three months.', priceKobo: 3000000 },
  { id: '6-months', months: 6, name: '6 Months', description: 'Long-term eSIM access for six months.', priceKobo: 6000000 },
  { id: '1-year', months: 12, name: '1 Year', description: 'Year-long eSIM access for twelve months.', priceKobo: 12000000 },
])

const ESIM_WHATSAPP_MESSAGES = Object.freeze({
  '1-month': 'Hello LMS Socials, I have paid for the 1 Month.,eSIM plan. My order reference is 6aa584dfdafe18df7136a4c5. Please send my eSIM QR code.',
  '3-months': 'Hello LMS Socials, I have paid for the 3.! Months eSIM plan. My order reference is 6ab4d5276a3682bca6922980. Please send my eSIM QR code.',
  '6-months': 'Hello LMS Socials, I have paid for the 6 Months.”eSIM plan. My order reference is 6aa58e71662d7d91bd0400b8. Please send my eSIM QR code.',
})

export function esimPriceKobo(value) {
  if (value === '' || value == null) return null
  const naira = Number(value)
  if (!Number.isFinite(naira) || naira < 100) return null
  const kobo = Math.round(naira * 100)
  return Number.isSafeInteger(kobo) ? kobo : null
}

export function normalizeEsimPrices(document = {}) {
  const stored = document.pricesKobo || {}
  return Object.fromEntries(ESIM_PLANS.map((plan) => {
    if (!Object.prototype.hasOwnProperty.call(stored, plan.id)) return [plan.id, plan.priceKobo]
    const price = Number(stored[plan.id])
    return [plan.id, Number.isSafeInteger(price) && price >= 10000 ? price : null]
  }))
}

export async function getEsimPlans(database, options = {}) {
  const settings = await database.collection('storeSettings').findOne({ _id: 'esim-pricing' }, options)
  const prices = normalizeEsimPrices(settings || {})
  return ESIM_PLANS.map((plan) => ({ ...plan, priceKobo: prices[plan.id] }))
}

export function esimWhatsAppUrl(order) {
  const number = String(process.env.ESIM_WHATSAPP_NUMBER || '').replace(/\D/g, '')
  if (!/^234\d{10}$/.test(number)) return null
  const reference = String(order._id)
  const message = ESIM_WHATSAPP_MESSAGES[order.planId]
    || `Hello LMS Socials, I have paid for the ${order.planName} eSIM plan. My order reference is ${reference}. Please send my eSIM code.`
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`
}

export function publicEsimOrder(order) {
  return {
    _id: String(order._id),
    planId: order.planId,
    planName: order.planName,
    months: order.months,
    priceKobo: order.priceKobo,
    status: order.status,
    createdAt: order.createdAt,
    contactUrl: esimWhatsAppUrl(order),
  }
}
