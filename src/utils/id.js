export function createId(prefix = "id") {
  const cryptoApi = typeof window !== "undefined" ? window.crypto : null;
  if (cryptoApi && cryptoApi.randomUUID) return `${prefix}_${cryptoApi.randomUUID()}`;
  return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}
