export const HIDDEN_NUMBER_COUNTRY_IDS = Object.freeze(['12'])

export const WHATSAPP_USA_SERVER_PROVIDERS = Object.freeze({
  '1': '3193',
  '2': '2617',
  '3': '3459',
})

export function isNumberCountryEnabled(countryId) {
  return !HIDDEN_NUMBER_COUNTRY_IDS.includes(String(countryId))
}

export function numberProviderForOffer({ countryId, serviceCode, serverId }) {
  if (String(countryId) !== '187' || String(serviceCode) !== 'wa') return undefined
  return WHATSAPP_USA_SERVER_PROVIDERS[String(serverId)]
}
