import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../lib/admin'
import { getDatabase } from '../../../../lib/mongodb'
import { getSupplierPricing, normalizeSupplierPricing } from '../../../../lib/supplier-pricing'

export const runtime = 'nodejs'

export async function GET() {
  if (!await getAdminSession()) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  return NextResponse.json({ pricing: await getSupplierPricing(await getDatabase()) })
}

export async function PATCH(request) {
  const admin = await getAdminSession()
  if (!admin) return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  const body = await request.json().catch(() => ({}))
  const values = [body.bulkaccMarkupPercent, body.sujanMarkupPercent]
  if (values.some((value) => !Number.isFinite(Number(value)) || Number(value) < 0 || Number(value) > 100)) {
    return NextResponse.json({ message: 'Each markup must be between 0% and 100%' }, { status: 400 })
  }
  const pricing = normalizeSupplierPricing(body)
  const now = new Date()
  const database = await getDatabase()
  await database.collection('storeSettings').updateOne(
    { _id: 'supplier-pricing' },
    { $set: { ...pricing, updatedAt: now, updatedBy: admin.email } },
    { upsert: true },
  )
  return NextResponse.json({ pricing })
}
