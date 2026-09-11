import { handleUpload } from '@vercel/blob/client'
import { NextResponse } from 'next/server'
import { getAdminSession } from '../../../../../lib/admin'
import { FORMAT_CONTENT_TYPES, MAX_FORMAT_FILE_SIZE, formatFileExtension } from '../../../../../lib/format-files'

export const runtime = 'nodejs'

const ALLOWED_EXTENSIONS = new Set(['pdf', 'txt'])

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
        if (!pathname.startsWith('formats/') || !ALLOWED_EXTENSIONS.has(formatFileExtension(pathname))) {
          throw new Error('Unsupported file type')
        }
        return {
          allowedContentTypes: FORMAT_CONTENT_TYPES,
          maximumSizeInBytes: MAX_FORMAT_FILE_SIZE,
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
