export const ESIM_PLANS = Object.freeze([
  { id: '1-month', months: 1, name: '1 Month', description: 'Short-term eSIM access for one month.' },
  { id: '3-months', months: 3, name: '3 Months', description: 'Extended eSIM access for three months.' },
  { id: '6-months', months: 6, name: '6 Months', description: 'Long-term eSIM access for six months.' },
])

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
  const message = `Hello LMS Socials, I have paid for the ${order.planName} eSIM plan. My order reference is ${reference}. Please send my eSIM code.`
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
