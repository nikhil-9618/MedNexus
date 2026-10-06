/**
 * Safe date/time helpers. All server logic uses ISO strings "YYYY-MM-DD"
 * for clinic dates (no timezone drift) and 24h "HH:MM" times.
 */
const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** True if str is exactly YYYY-MM-DD and a real calendar date. */
function isISODate(str) {
  if (typeof str !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(str)) return false;
  const [y, m, d] = str.split('-').map(Number);
  if (m < 1 || m > 12) return false;
  const daysInMonth = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return d >= 1 && d <= daysInMonth;
}

/** "YYYY-MM-DD" -> UTC Date at midnight. */
function parseISODate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Format a Date (UTC) as YYYY-MM-DD. */
function formatISODate(date) {
  return date.toISOString().slice(0, 10);
}

/** Today in UTC as YYYY-MM-DD. */
function todayISO() {
  return formatISODate(new Date());
}

function addDaysISO(dateStr, days) {
  return formatISODate(new Date(parseISODate(dateStr).getTime() + days * MS_PER_DAY));
}

function diffDays(fromISO, toISO) {
  return Math.round((parseISODate(toISO) - parseISODate(fromISO)) / MS_PER_DAY);
}

/** True if time is 24h HH:MM with valid ranges. */
function isHHMM(str) {
  if (typeof str !== 'string' || !/^\d{2}:\d{2}$/.test(str)) return false;
  const [h, m] = str.split(':').map(Number);
  return h >= 0 && h <= 23 && m >= 0 && m <= 59;
}

/** Convert "HH:MM" to minutes since midnight. */
function timeToMinutes(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

module.exports = {
  isISODate,
  parseISODate,
  formatISODate,
  todayISO,
  addDaysISO,
  diffDays,
  isHHMM,
  timeToMinutes,
};
