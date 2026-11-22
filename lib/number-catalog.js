export const HIDDEN_NUMBER_COUNTRY_IDS = Object.freeze(['12'])

export const WHATSAPP_USA_SERVER_PROVIDERS = Object.freeze({
  '1': '3328',
  '2': '2368',
  '3': '3193',
})

export const WHATSAPP_UK_SERVER_PROVIDERS = Object.freeze({
  '1': '3451',
  '2': '3514',
  '3': '3371',
})

// Verified against the supplier's live Australia (country 175) WhatsApp
// inventory. These are preferred products; the quote flow falls back when a
// preferred supplier has no stock.
export const WHATSAPP_AUSTRALIA_SERVER_PROVIDERS = Object.freeze({
  '1': '2368',
  '2': '3514',
  '3': '3451',
})

export const WHATSAPP_SPAIN_SERVER_PROVIDERS = Object.freeze({
  '1': '3340',
  '2': '3443',
  '3': '3451',
})

export function isNumberCountryEnabled(countryId) {
  return !HIDDEN_NUMBER_COUNTRY_IDS.includes(String(countryId))
}

export function numberProviderForOffer({ countryId, serviceCode, serverId }) {
  if (String(serviceCode) !== 'wa') return undefined
  if (String(countryId) === '187') return WHATSAPP_USA_SERVER_PROVIDERS[String(serverId)]
  if (String(countryId) === '16') return WHATSAPP_UK_SERVER_PROVIDERS[String(serverId)]
  if (String(countryId) === '175') return WHATSAPP_AUSTRALIA_SERVER_PROVIDERS[String(serverId)]
  if (String(countryId) === '56') return WHATSAPP_SPAIN_SERVER_PROVIDERS[String(serverId)]
  return undefined
}
