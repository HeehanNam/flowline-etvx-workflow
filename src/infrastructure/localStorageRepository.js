const KEY = "flowline.etvx.mvp.v1";
export class LocalStorageRepository {
  constructor(seed) { this.seed = seed; }
  load() { try { const data = localStorage.getItem(KEY); if (data) return JSON.parse(data); } catch (e) { console.warn(e); } const initial = structuredClone(this.seed); this.save(initial); return initial; }
  save(state) { localStorage.setItem(KEY, JSON.stringify(state)); }
  reset() { localStorage.removeItem(KEY); return this.load(); }
}
