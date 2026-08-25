/**
 * Nanakshahi Calendar Conversion
 *
 * The Nanakshahi calendar is the Sikh calendar. Key rules:
 * - Year 1 corresponds to 1469 CE (birth of Guru Nanak Dev Ji)
 * - New Year (1 Chet) falls on March 14 every year
 * - First 5 months: 31 days each; last 7 months: 30 days each
 * - Nanakshahi Year = Gregorian Year - 1468 (from March 14 onwards)
 *
 * Sources: sikhiwiki.org, sikhri.org (Content was rephrased for compliance with licensing restrictions)
 */

// Gurmukhi numerals
const GURMUKHI_DIGITS = ["੦", "੧", "੨", "੩", "੪", "੫", "੬", "੭", "੮", "੯"];

// Nanakshahi months in Gurmukhi
const NANAKSHAHI_MONTHS = [
  "ਚੇਤ",    // Chet
  "ਵੈਸਾਖ",  // Vaisakh
  "ਜੇਠ",    // Jeth
  "ਹਾੜ੍ਹ",   // Harh
  "ਸਾਵਣ",   // Sawan
  "ਭਾਦੋਂ",   // Bhadon
  "ਅੱਸੂ",    // Assu
  "ਕੱਤਕ",   // Kattak
  "ਮੱਘਰ",   // Maghar
  "ਪੋਹ",    // Poh
  "ਮਾਘ",    // Magh
  "ਫੱਗਣ",   // Phagan
];

// Days in each Nanakshahi month (first 5 = 31, last 7 = 30)
const MONTH_DAYS = [31, 31, 31, 31, 31, 30, 30, 30, 30, 30, 30, 30];

// Gregorian start dates for each Nanakshahi month (month is 0-indexed, day is 1-indexed)
// These are fixed each year
const MONTH_STARTS: Array<{ month: number; day: number }> = [
  { month: 2, day: 14 },  // Chet: March 14
  { month: 3, day: 14 },  // Vaisakh: April 14
  { month: 4, day: 15 },  // Jeth: May 15
  { month: 5, day: 15 },  // Harh: June 15
  { month: 6, day: 16 },  // Sawan: July 16
  { month: 7, day: 16 },  // Bhadon: Aug 16
  { month: 8, day: 15 },  // Assu: Sep 15
  { month: 9, day: 15 },  // Kattak: Oct 15
  { month: 10, day: 14 }, // Maghar: Nov 14
  { month: 11, day: 14 }, // Poh: Dec 14
  { month: 0, day: 13 },  // Magh: Jan 13
  { month: 1, day: 12 },  // Phagan: Feb 12
];

// Punjabi day names
const PUNJABI_DAYS = [
  "ਐਤਵਾਰ",   // Sunday
  "ਸੋਮਵਾਰ",   // Monday
  "ਮੰਗਲਵਾਰ",  // Tuesday
  "ਬੁੱਧਵਾਰ",   // Wednesday
  "ਵੀਰਵਾਰ",   // Thursday
  "ਸ਼ੁੱਕਰਵਾਰ", // Friday
  "ਸ਼ਨਿੱਚਰਵਾਰ", // Saturday
];

/** Convert a number to Gurmukhi numerals */
function toGurmukhi(num: number): string {
  return String(num)
    .split("")
    .map((d) => GURMUKHI_DIGITS[parseInt(d, 10)])
    .join("");
}

interface NanakshahiDate {
  day: number;
  month: number; // 0-indexed
  year: number;
  monthName: string;
  dayOfWeek: string; // Punjabi day name
}

/** Convert a Gregorian Date to Nanakshahi calendar date */
export function toNanakshahi(date: Date = new Date()): NanakshahiDate {
  const gYear = date.getFullYear();
  const gMonth = date.getMonth(); // 0-indexed
  const gDay = date.getDate();
  const dayOfWeek = PUNJABI_DAYS[date.getDay()];

  // Build the actual Gregorian start date for each Nanakshahi month in the relevant year
  // Months 0-9 (Chet through Poh) start in the same Gregorian year
  // Months 10-11 (Magh, Phagan) start in the NEXT Gregorian year (Jan/Feb)

  // Determine which Nanakshahi year we might be in
  // If date >= March 14 of gYear, we're in Nanakshahi year (gYear - 1468)
  // If date < March 14 of gYear, we're in Nanakshahi year (gYear - 1469)
  const march14 = new Date(gYear, 2, 14);
  const nYear = date >= march14 ? gYear - 1468 : gYear - 1469;

  // The Gregorian year in which this Nanakshahi year's Chet starts
  const chetGYear = nYear + 1468;

  // Build start dates for all 12 months of this Nanakshahi year
  const monthStarts: Date[] = [];
  for (let i = 0; i < 12; i++) {
    const start = MONTH_STARTS[i];
    if (i <= 9) {
      // Chet through Poh: same Gregorian year as Chet
      monthStarts.push(new Date(chetGYear, start.month, start.day));
    } else {
      // Magh and Phagan: next Gregorian year
      monthStarts.push(new Date(chetGYear + 1, start.month, start.day));
    }
  }

  // Find which month the date falls in (go backwards from month 11)
  for (let i = 11; i >= 0; i--) {
    if (date >= monthStarts[i]) {
      const diffMs = date.getTime() - monthStarts[i].getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      return {
        day: diffDays + 1,
        month: i,
        year: nYear,
        monthName: NANAKSHAHI_MONTHS[i],
        dayOfWeek,
      };
    }
  }

  // Should not reach here for valid dates
  return { day: 1, month: 0, year: nYear, monthName: NANAKSHAHI_MONTHS[0], dayOfWeek };
}

/** Format a Nanakshahi date as Gurmukhi string like "੯ ਭਾਦੋਂ ੫੫੮ ਨਾਨਕਸ਼ਾਹੀ" */
export function formatNanakshahiDate(date: Date = new Date()): string {
  const nd = toNanakshahi(date);
  return `${toGurmukhi(nd.day)} ${nd.monthName} ${toGurmukhi(nd.year)} ਨਾਨਕਸ਼ਾਹੀ`;
}

/** Get Punjabi day name for a date */
export function getPunjabiDay(date: Date = new Date()): string {
  return PUNJABI_DAYS[date.getDay()];
}
