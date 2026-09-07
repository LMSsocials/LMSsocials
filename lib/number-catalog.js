export const HIDDEN_NUMBER_COUNTRY_IDS = Object.freeze(['12'])

export function isNumberCountryEnabled(countryId) {
  return !HIDDEN_NUMBER_COUNTRY_IDS.includes(String(countryId))
}
