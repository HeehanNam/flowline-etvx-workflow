const LOCAL_KEY = "flowline.etvx.mvp.v1";

export class ApiRepository {
  constructor(seed) { this.seed = seed; this.pending = Promise.resolve(); this.mode = "api"; }

  async load() {
    try {
      const response = await fetch("/api/state");
      const contentType = response.headers.get("content-type") || "";
      if (!response.ok || !contentType.includes("application/json")) throw new Error("API unavailable");
      const payload = await response.json();
      if (payload.state) return payload.state;
      const initial = this.loadLocal();
      await this.save(initial);
      return initial;
    } catch (error) {
      this.mode = "local";
      console.info("정적 호스팅 모드: 브라우저 저장소를 사용합니다.");
      return this.loadLocal();
    }
  }

  save(state) {
    const snapshot = structuredClone(state);
    if (this.mode === "local") {
      this.saveLocal(snapshot);
      return Promise.resolve();
    }
    this.pending = this.pending.then(async () => {
      const response = await fetch("/api/state", {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state: snapshot })
      });
      if (!response.ok) throw new Error("Workflow 저장에 실패했습니다.");
    }).catch(error => {
      this.mode = "local";
      this.saveLocal(snapshot);
      console.warn("서버 저장에 실패해 브라우저 저장소로 전환했습니다.", error);
    });
    return this.pending;
  }

  loadLocal() {
    try {
      const saved = localStorage.getItem(LOCAL_KEY);
      if (saved) return JSON.parse(saved);
    } catch (error) { console.warn("브라우저 데이터를 불러오지 못했습니다.", error); }
    const initial = structuredClone(this.seed);
    this.saveLocal(initial);
    return initial;
  }

  saveLocal(state) {
    try { localStorage.setItem(LOCAL_KEY, JSON.stringify(state)); }
    catch (error) { console.error("브라우저 저장에 실패했습니다.", error); }
  }
}
