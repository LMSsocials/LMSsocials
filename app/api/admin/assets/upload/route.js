import { handleUpload } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../../lib/admin'

export const runtime = 'nodejs'

const MAX_FILE_SIZE = 100 * 1024 * 1024
const ALLOWED_EXTENSIONS = new Set(['pdf'])
const ALLOWED_CONTENT_TYPES = ['application/pdf']

const extensionOf = (name) => String(name).toLowerCase().split('.').pop()

export async function POST(request) {
  if (!await getAdminSession()) {
    return NextResponse.json({ message: 'Admin access required' }, { status: 403 })
  }

  try {
    const body = await request.json()
    const response = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname) => {
        if (!pathname.startsWith('formats/') || !ALLOWED_EXTENSIONS.has(extensionOf(pathname))) {
          throw new Error('Unsupported file type')
        }
        return {
          allowedContentTypes: ALLOWED_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FILE_SIZE,
          addRandomSuffix: true,
          allowOverwrite: false,
        }
      },
    })
    return NextResponse.json(response)
  } catch (error) {
    return NextResponse.json({ message: error?.message || 'Unable to authorize upload' }, { status: 400 })
  }
}
