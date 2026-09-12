import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { ESIM_PLANS, esimPriceKobo, getEsimPlans } from '../../../../lib/esim'
import { getDatabase } from '../../../../lib/mongodb'

export const runtime = 'nodejs'

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  return NextResponse.json({ plans: await getEsimPlans(await getDatabase()) })
}

export async function PATCH(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const submitted = body.prices || {}
  const pricesKobo = {}
  for (const plan of ESIM_PLANS) {
    const value = submitted[plan.id]
    if (value === '' || value == null) {
      pricesKobo[plan.id] = null
      continue
    }
    const priceKobo = esimPriceKobo(value)
    if (!priceKobo) return NextResponse.json({ message: `${plan.name} must be at least ₦100 or left blank` }, { status: 400 })
    pricesKobo[plan.id] = priceKobo
  }

  const database = await getDatabase()
  await database.collection('storeSettings').updateOne(
    { _id: 'esim-pricing' },
    { $set: { pricesKobo, updatedAt: new Date(), updatedBy: admin.email } },
    { upsert: true },
  )
  return NextResponse.json({ plans: await getEsimPlans(database) })
}
