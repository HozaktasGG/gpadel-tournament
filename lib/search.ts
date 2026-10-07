// Case- and accent-insensitive key, incl. Turkish letters (ı, İ, ş, ğ, ç, ö, ü).
export function searchKey(s: string | null | undefined) {
  return (s ?? '')
    .replace(/ı/g, 'i')
    .replace(/İ/g, 'i')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
}
