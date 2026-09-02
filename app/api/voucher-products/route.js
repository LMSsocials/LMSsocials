import { NextResponse } from 'next/server'
import { getDatabase } from '../../../lib/mongodb'

export const runtime = 'nodejs'

export async function GET() {
  const database = await getDatabase()
  const products = await database.collection('voucherProducts')
    .find({ isPublished: true }, { projection: { title: 1, brand: 1, category: 1, description: 1, imageUrl: 1, priceKobo: 1, stockCount: 1 } })
    .sort({ stockCount: -1, createdAt: -1 })
    .limit(100)
    .toArray()

  return NextResponse.json({
    products: products.map((product) => ({ ...product, _id: String(product._id) })),
  })
}
