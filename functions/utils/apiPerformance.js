const crypto = require('crypto');

const toPositiveInteger = (value, fallback = null) => {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const applyOptionalPagination = (query, queryParams = {}) => {
  const limit = toPositiveInteger(queryParams.limit);
  if (!limit) return query;

  const page = toPositiveInteger(queryParams.page, 1);
  return query.skip((page - 1) * limit).limit(limit);
};

const hrtimeMs = (start) => Number(process.hrtime.bigint() - start) / 1e6;

const timed = async (label, timings, work) => {
  const start = process.hrtime.bigint();
  const result = await work();
  timings[label] = Math.round(hrtimeMs(start));
  return result;
};

const timedSync = (label, timings, work) => {
  const start = process.hrtime.bigint();
  const result = work();
  timings[label] = Math.round(hrtimeMs(start));
  return result;
};

const getPayloadSizeBytes = (payload) => Buffer.byteLength(JSON.stringify(payload));

const logApiTiming = (req, timings, payload) => {
  const sizeBytes = getPayloadSizeBytes(payload);
  console.log(
    `[api-perf] ${req.method} ${req.originalUrl || req.url} db=${timings.db || 0}ms serialization=${
      timings.serialization || 0
    }ms bytes=${sizeBytes}`
  );
  return sizeBytes;
};

const createWeakEtag = (payload) => {
  const hash = crypto.createHash('sha1').update(JSON.stringify(payload)).digest('base64url');
  return `W/"${hash}"`;
};

const getLatestTimestamp = (items, fields = ['updatedAt', 'createdAt']) => {
  let latest = 0;

  items.forEach((item) => {
    fields.forEach((field) => {
      const value = item?.[field];
      if (!value) return;
      const time = new Date(value).getTime();
      if (!Number.isNaN(time) && time > latest) latest = time;
    });
  });

  return latest ? new Date(latest) : null;
};

module.exports = {
  applyOptionalPagination,
  createWeakEtag,
  getLatestTimestamp,
  logApiTiming,
  timed,
  timedSync,
};
