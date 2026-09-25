import { createId } from "../utils/id.js";
import { escapeHtml } from "../utils/html.js";

const FORMAT = "flowline-workflow";
const VERSION = 1;
const statusLabels = { blocked: "진입 대기", ready: "수행 가능", in_progress: "진행 중", completed: "완료" };

export function cloneWorkflowAsTemplate(source, name = source.name) {
  if (!source || !source.tasks || !Array.isArray(source.tasks)) throw new Error("유효한 Workflow 정의가 아닙니다.");
  const now = new Date().toISOString();
  const taskIds = new Map(source.tasks.map(task => [task.id, createId("task")]));
  return {
    ...structuredClone(source),
    id: createId("wf"),
    name: name.trim() || `${source.name} 템플릿`,
    version: 1,
    createdAt: now,
    updatedAt: now,
    tasks: source.tasks.map(task => ({
      ...structuredClone(task),
      id: taskIds.get(task.id),
      dependencies: (task.dependencies || []).map(id => taskIds.get(id)).filter(Boolean),
      position: task.position ? { ...task.position } : null,
      subtasks: (task.subtasks || []).map(item => ({ ...structuredClone(item), id: createId("subtask") })),
      checklist: (task.checklist || []).map(item => ({ ...structuredClone(item), id: createId("check") }))
    }))
  };
}

export function serializeWorkflow(workflow) {
  return JSON.stringify({ format: FORMAT, version: VERSION, exportedAt: new Date().toISOString(), workflow }, null, 2);
}

export function parseWorkflow(text) {
  let payload;
  try { payload = JSON.parse(text); }
  catch { throw new Error("JSON 파일을 읽을 수 없습니다."); }
  const source = payload && payload.format === FORMAT ? payload.workflow : payload;
  if (!source || typeof source.name !== "string" || !Array.isArray(source.tasks)) throw new Error("Flowline Workflow JSON 형식이 아닙니다.");
  return cloneWorkflowAsTemplate(source, `${source.name} · 가져옴`);
}

export function downloadText(filename, content, type = "application/json;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeFilename(value) {
  return String(value || "workflow").trim().replace(/[\\/:*?"<>|]+/g, "-").replace(/\s+/g, "_").slice(0, 80) || "workflow";
}

export function buildRunReport(run) {
  const workflow = run.definitionSnapshot;
  const completed = run.tasks.filter(task => task.status === "completed").length;
  const progress = run.tasks.length ? Math.round(completed / run.tasks.length * 100) : 0;
  const generatedAt = new Date().toLocaleString("ko-KR");
  const taskRows = workflow.tasks.map((task, index) => {
    const runtime = run.tasks.find(item => item.taskId === task.id);
    const checked = runtime ? runtime.checklist.filter(item => item.checked).length : 0;
    const subDone = runtime ? runtime.subtasks.filter(item => item.completed).length : 0;
    const runtimeStatus = runtime ? runtime.status : "blocked";
    const subtaskDone = item => { const value = runtime && runtime.subtasks.find(entry => entry.itemId === item.id); return value && value.completed; };
    const checklistDone = item => { const value = runtime && runtime.checklist.find(entry => entry.itemId === item.id); return value && value.checked; };
    return `<section class="task"><header><span>${String(index + 1).padStart(2, "0")}</span><div><h2>${escapeHtml(task.title)}</h2><p>${escapeHtml(task.assignee)} · ${escapeHtml(task.priority)}</p></div><b class="status ${runtimeStatus}">${statusLabels[runtimeStatus] || "진입 대기"}</b></header><div class="etvx"><div><b>E</b><p>${escapeHtml(task.entry || "-")}</p></div><div><b>T</b><p>${escapeHtml(task.instructions || "-")}</p></div><div><b>X</b><p>${escapeHtml(task.exit || "-")}</p></div></div>${task.subtasks.length ? `<h3>Subtask <small>${subDone}/${task.subtasks.length}</small></h3><ul>${task.subtasks.map(item => `<li>${subtaskDone(item) ? "☑" : "☐"} ${escapeHtml(item.title)}${item.required ? " <em>필수</em>" : ""}</li>`).join("")}</ul>` : ""}<h3>Validation 체크리스트 <small>${checked}/${task.checklist.length}</small></h3><ul>${task.checklist.map(item => `<li>${checklistDone(item) ? "☑" : "☐"} ${escapeHtml(item.text)}${item.required ? " <em>필수</em>" : ""}</li>`).join("")}</ul></section>`;
  }).join("");
  const history = run.history.slice(0, 12).map(item => `<li><span>${escapeHtml(new Date(item.at).toLocaleString("ko-KR"))}</span>${escapeHtml(item.message)}</li>`).join("");
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(run.name)} · Flowline Report</title><style>body{margin:0;background:#f3f5f4;color:#17211d;font:14px/1.55 Arial,"Noto Sans KR",sans-serif}.page{max-width:900px;margin:auto;padding:40px 24px}.hero,.task,.history{background:#fff;border:1px solid #dce3df;border-radius:16px;padding:24px;margin-bottom:18px}.hero{display:grid;grid-template-columns:1fr 180px;gap:24px}.eyebrow{font-size:10px;letter-spacing:.14em;color:#1e6b50;font-weight:800}.hero h1{margin:8px 0}.hero p{color:#68746e}.progress strong{font-size:36px;color:#1e6b50}.bar{height:9px;background:#e5ebe8;border-radius:8px;overflow:hidden}.bar i{display:block;height:100%;background:#1e6b50}.task header{display:flex;align-items:center;gap:13px}.task header>span{display:grid;place-items:center;width:34px;height:34px;border-radius:9px;background:#e9f3ee;color:#1e6b50;font-weight:800}.task h2{margin:0;font-size:18px}.task header p{margin:2px 0;color:#758079;font-size:12px}.status{margin-left:auto;padding:6px 9px;border-radius:12px;background:#edf0ee;font-size:11px}.status.completed{background:#daf0e4;color:#176444}.status.in_progress{background:#fff1cf;color:#8a6410}.status.ready{background:#e8edff;color:#3c55ad}.etvx{display:grid;gap:8px;margin:18px 0}.etvx>div{display:grid;grid-template-columns:28px 1fr;gap:10px;align-items:start}.etvx b{display:grid;place-items:center;height:26px;border-radius:7px;background:#1e6b50;color:#fff}.etvx p{margin:2px 0}.task h3{margin:16px 0 6px;font-size:12px}.task h3 small{color:#758079}.task ul{list-style:none;margin:0;padding:0}.task li{padding:5px 0;border-bottom:1px solid #eef1ef}.task em{font-size:10px;color:#7356b4}.history ul{padding-left:0;list-style:none}.history li{padding:8px 0;border-bottom:1px solid #edf0ee}.history li span{display:inline-block;width:180px;color:#7b8580;font-size:11px}@media print{body{background:white}.page{max-width:none;padding:0}.task,.hero,.history{break-inside:avoid;box-shadow:none}}@media(max-width:600px){.hero{grid-template-columns:1fr}.history li span{display:block;width:auto}}</style></head><body><main class="page"><section class="hero"><div><span class="eyebrow">FLOWLINE · WORKFLOW REPORT</span><h1>${escapeHtml(run.name)}</h1><p>${escapeHtml(workflow.name)} · Version ${escapeHtml(run.workflowVersion)}<br>생성 ${escapeHtml(generatedAt)}</p></div><div class="progress"><span>전체 진행률</span><strong>${progress}%</strong><div class="bar"><i style="width:${progress}%"></i></div><p>${completed}/${run.tasks.length} Task 완료</p></div></section>${taskRows}<section class="history"><span class="eyebrow">ACTIVITY</span><h2>최근 활동</h2><ul>${history || "<li>기록 없음</li>"}</ul></section></main></body></html>`;
}
