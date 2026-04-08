function nowIso() {
  return new Date().toISOString();
}

function toMs(value) {
  if (!value) return 0;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : 0;
}

module.exports = { nowIso, toMs };
