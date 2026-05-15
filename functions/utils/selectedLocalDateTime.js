const localDateTimePattern =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,3}))?)?(?:Z|[+-]\d{2}:?\d{2})?$/;

const pad = (value, length = 2) => value.toString().padStart(length, '0');

const parseSelectedLocalDateTime = (value) => {
  if (value instanceof Date) return selectedLocalDateTimeFromDate(value);
  if (typeof value !== 'string') return null;

  const match = value.trim().match(localDateTimePattern);
  if (!match) return null;

  const [, year, month, day, hour, minute, second = '00', millisecond = '0'] = match;
  const normalizedMillisecond = millisecond.padEnd(3, '0');
  const parsed = new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
      Number(normalizedMillisecond)
    )
  );

  const isValid =
    parsed.getUTCFullYear() === Number(year) &&
    parsed.getUTCMonth() === Number(month) - 1 &&
    parsed.getUTCDate() === Number(day) &&
    parsed.getUTCHours() === Number(hour) &&
    parsed.getUTCMinutes() === Number(minute) &&
    parsed.getUTCSeconds() === Number(second);

  return isValid ? parsed : null;
};

const selectedLocalDateTimeFromDate = (value) => {
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return null;

  return new Date(
    Date.UTC(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
      value.getMinutes(),
      value.getSeconds(),
      value.getMilliseconds()
    )
  );
};

const formatSelectedLocalDateTime = (value) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(
    date.getUTCHours()
  )}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}.${pad(date.getUTCMilliseconds(), 3)}`;
};

module.exports = {
  formatSelectedLocalDateTime,
  parseSelectedLocalDateTime,
  selectedLocalDateTimeFromDate,
};
