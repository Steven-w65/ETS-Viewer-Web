/** Validate an original directory timestamp without inventing a fallback. */
export function validTimestamp(value: unknown): number | null {
  return typeof value === 'number' && value >= 0 && Number.isFinite(new Date(value).getTime())
    ? value
    : null;
}

/** ZIP's DOS timestamp stores local calendar time with two-second precision. */
export function zipTimestamp(time: number, date: number): number | null {
  const year = 1980 + (date >>> 9),
    month = (date >>> 5) & 15,
    day = date & 31;
  const hour = time >>> 11,
    minute = (time >>> 5) & 63,
    second = (time & 31) * 2;
  const value = new Date(year, month - 1, day, hour, minute, second, 0);
  if (
    value.getFullYear() !== year ||
    value.getMonth() !== month - 1 ||
    value.getDate() !== day ||
    value.getHours() !== hour ||
    value.getMinutes() !== minute ||
    value.getSeconds() !== second
  )
    return null;
  return validTimestamp(value.getTime());
}
