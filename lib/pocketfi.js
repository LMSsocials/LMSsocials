export async function createPocketFiVirtualAccount({ name, email }) {
  const baseUrl = process.env.POCKETFI_BASE_URL
  const apiKey = process.env.POCKETFI_API_KEY
  const businessId = process.env.POCKETFI_MERCHANT_ID
  const phone = String(process.env.POCKETFI_FALLBACK_PHONE || '').replace(/[^0-9+]/g, '')
  if (!baseUrl || !apiKey || !businessId || !/^\+?[0-9]{10,15}$/.test(phone)) {
    throw new Error('PocketFi virtual-account configuration is incomplete')
  }
  const names = String(name || 'LMS Customer').trim().split(/\s+/)
  const response = await fetch(`${baseUrl}/virtual-accounts/create`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ first_name: names[0], last_name: names.slice(1).join(' ') || 'Customer', phone, email, businessId, bank: 'kuda' }),
    signal: AbortSignal.timeout(20000),
  })
  const payload = await response.json().catch(() => ({}))
  const bank = Array.isArray(payload.banks) ? payload.banks[0] : null
  if (!response.ok || payload.status !== true || !bank?.accountNumber) throw new Error(payload.message || 'PocketFi could not generate an account')
  return { bankName: String(bank.bankName || 'Kuda'), accountNumber: String(bank.accountNumber), accountName: String(bank.accountName || names.join(' ')), createdAt: new Date() }
}
