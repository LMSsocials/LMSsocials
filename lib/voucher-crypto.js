import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

function encryptionKey() {
  const secret = process.env.VOUCHER_ENCRYPTION_SECRET || process.env.AUTH_JWT_SECRET
  if (!secret || secret.length < 32) throw new Error('Voucher encryption secret is not configured')
  return createHash('sha256').update(secret).digest()
}

export function voucherCodeHash(productId, code) {
  return createHash('sha256').update(`${productId}:${code.trim()}`).digest('hex')
}

export function encryptVoucherCode(code) {
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv)
  const encrypted = Buffer.concat([cipher.update(code, 'utf8'), cipher.final()])
  return { encryptedCode: encrypted.toString('base64'), codeIv: iv.toString('base64'), codeTag: cipher.getAuthTag().toString('base64') }
}

export function decryptVoucherCode(item) {
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(item.codeIv, 'base64'))
  decipher.setAuthTag(Buffer.from(item.codeTag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(item.encryptedCode, 'base64')), decipher.final()]).toString('utf8')
}
