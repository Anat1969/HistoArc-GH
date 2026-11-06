/**
 * Approximate centre points of the cases, for the satellite map.
 * Precision: city centres and named landmarks, about a few hundred metres [ה].
 * The ten calibrated cities use the exact points of pipeline/calibrate.py.
 * Unbuilt projects (Ville Radieuse, Broadacre City) have no place.
 */
export const PLACES: Record<number, { lat: number; lon: number; note: string }> = {
  1: { lat: 27.3294, lon: 68.1386, note: 'אתר החפירות, העיר העליונה' },
  2: { lat: 32.5422, lon: 44.4209, note: 'אתר בבל העתיקה' },
  3: { lat: 37.5301, lon: 27.2786, note: 'אתר מילטוס' },
  4: { lat: 19.6925, lon: -98.8438, note: 'שדרת המתים' },
  5: { lat: 41.8986, lon: 12.4769, note: 'הפנתאון, מרכז רומא' },
  6: { lat: 34.2655, lon: 108.9543, note: 'שיאן של היום, בתוך שטח צ\'אנג-אן' },
  7: { lat: 35.0116, lon: 135.7681, note: 'נקודת הכיול' },
  8: { lat: 34.0644, lon: -4.9733, note: 'נקודת הכיול' },
  9: { lat: 32.9214, lon: 35.07, note: 'העיר העתיקה' },
  10: { lat: 43.3186, lon: 11.3307, note: 'נקודת הכיול' },
  11: { lat: 44.6806, lon: 0.8944, note: 'הכיכר המרכזית' },
  12: { lat: 45.9056, lon: 13.3097, note: 'הכיכר המרכזית' },
  13: { lat: 41.9009, lon: 12.4833, note: 'מרכז רומא' },
  14: { lat: 48.8049, lon: 2.1204, note: 'הארמון' },
  15: { lat: 32.6575, lon: 51.6777, note: 'כיכר נקש-ה-ג\'האן' },
  16: { lat: 26.9239, lon: 75.8267, note: 'העיר המוקפת חומה' },
  17: { lat: 40.7549, lon: -73.984, note: 'נקודת הכיול, מידטאון' },
  18: { lat: 48.872, lon: 2.3316, note: 'נקודת הכיול, האופרה' },
  19: { lat: 41.3917, lon: 2.1649, note: 'נקודת הכיול' },
  20: { lat: 51.9785, lon: -0.2297, note: 'מרכז העיר' },
  21: { lat: 32.6905, lon: 35.1958, note: 'מרכז המושב' },
  22: { lat: 32.0771, lon: 34.7746, note: 'נקודת הכיול' },
  26: { lat: 30.7333, lon: 76.7794, note: 'נקודת הכיול' },
  27: { lat: 31.7918, lon: 34.6497, note: 'נקודת הכיול' },
  28: { lat: -15.7939, lon: -47.8828, note: 'נקודת הכיול' },
  29: { lat: 31.252, lon: 34.7915, note: 'מרכז באר שבע. מיקום השיכון לא אומת [נ]' },
  31: { lat: 30.3208, lon: -86.1405, note: 'מרכז העיירה' },
  32: { lat: 19.038, lon: 72.8538, note: 'מרכז דהראווי' },
  33: { lat: 24.4269, lon: 54.6177, note: 'מצדר' },
  35: { lat: 31.8044, lon: 34.6385, note: 'אזור הטבעות והמע"ר הימי, מקורב [ה]' },
  23: { lat: 51.8393, lon: 12.2273, note: 'בניין הבאוהאוס' },
  30: { lat: 35.6655, lon: 139.7635, note: 'מיקום המגדל (נהרס 2022)' },
  34: { lat: 40.3958, lon: 49.8678, note: 'מרכז היידר אלייב' },
  36: { lat: 45.531, lon: 11.5605, note: 'וילה רוטונדה' },
  37: { lat: 41.7897, lon: -87.596, note: 'בית רובי' },
  38: { lat: 48.9245, lon: 2.0283, note: 'וילה סבואה' },
};
