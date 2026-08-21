/**
 * API javobini xavfsiz ravishda massivga aylantiruvchi utility.
 * Django REST framework pagination (results) va boshqa strukturalarni qo'llab-quvvatlaydi.
 * 
 * @param {*} data - API javobi (massiv, object, null, undefined)
 * @returns {Array} - Har doim massiv qaytaradi
 */
export const safeArray = (data) => {
  if (Array.isArray(data)) return data;
  if (data && typeof data === 'object' && Array.isArray(data.results)) return data.results;
  if (data && typeof data === 'object' && Array.isArray(data.data)) return data.data;
  return [];
};

/**
 * API javobining uzunligini xavfsiz olish
 */
export const safeLength = (data) => safeArray(data).length;
