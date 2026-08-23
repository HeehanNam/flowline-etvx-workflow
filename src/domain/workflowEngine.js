import { createId } from "../utils/id.js";
const now = () => new Date().toISOString();
const event = (type, message) => ({ id: createId("event"), at: now(), type, message });

export function startInstance(workflow, name) {
  const createdAt = now();
  return {
    id: createId("run"), workflowId: workflow.id, workflowVersion: workflow.version,
    name: name?.trim() || `${workflow.name} 실행`, status: "active", createdAt,
    updatedAt: createdAt, completedAt: null, definitionSnapshot: structuredClone(workflow),
    tasks: workflow.tasks.map(task => ({ taskId: task.id, status: task.dependencies.length ? "blocked" : "ready", startedAt: null, completedAt: null, subtasks: task.subtasks.map(item => ({ itemId: item.id, completed: false })), checklist: task.checklist.map(item => ({ itemId: item.id, checked: false })) })),
    history: [event("instance_started", `“${workflow.name}” 실행을 시작했습니다.`)]
  };
}
export const getTaskDefinition = (instance, taskId) => instance.definitionSnapshot.tasks.find(t => t.id === taskId);
export function requiredChecksComplete(instance, taskId) {
  const runTask = instance.tasks.find(t => t.taskId === taskId);
  const definition = getTaskDefinition(instance, taskId);
  const checksDone = definition.checklist.filter(i => i.required).every(i => runTask.checklist.find(c => c.itemId === i.id)?.checked);
  const subtasksDone = definition.subtasks.filter(i => i.required).every(i => runTask.subtasks.find(c => c.itemId === i.id)?.completed);
  return checksDone && subtasksDone;
}
export function startTask(instance, taskId) {
  const next = structuredClone(instance), task = next.tasks.find(t => t.taskId === taskId);
  if (!task || task.status !== "ready") throw new Error("현재 시작할 수 없는 Task입니다.");
  task.status = "in_progress"; task.startedAt = now(); next.updatedAt = now();
  next.history.unshift(event("task_started", `“${getTaskDefinition(next, taskId).title}” 업무를 시작했습니다.`)); return next;
}
export function toggleChecklist(instance, taskId, itemId) {
  const next = structuredClone(instance), task = next.tasks.find(t => t.taskId === taskId);
  if (!task || !["ready", "in_progress"].includes(task.status)) throw new Error("현재 체크할 수 없는 Task입니다.");
  if (task.status === "ready") { task.status = "in_progress"; task.startedAt = now(); }
  const check = task.checklist.find(c => c.itemId === itemId); check.checked = !check.checked; next.updatedAt = now(); return next;
}
export function toggleSubtask(instance, taskId, itemId) {
  const next = structuredClone(instance), task = next.tasks.find(t => t.taskId === taskId);
  if (!task || !["ready", "in_progress"].includes(task.status)) throw new Error("현재 수행할 수 없는 Task입니다.");
  if (task.status === "ready") { task.status = "in_progress"; task.startedAt = now(); }
  const subtask = task.subtasks.find(item => item.itemId === itemId); subtask.completed = !subtask.completed; next.updatedAt = now(); return next;
}

function unlockEligibleTasks(instance) {
  instance.tasks.filter(task => task.status === "blocked").forEach(runTask => {
    const definition = getTaskDefinition(instance, runTask.taskId);
    const ready = definition.dependencies.every(id => instance.tasks.find(task => task.taskId === id)?.status === "completed");
    if (ready) runTask.status = "ready";
  });
}
export function completeTask(instance, taskId) {
  if (!requiredChecksComplete(instance, taskId)) throw new Error("필수 체크리스트를 모두 완료해 주세요.");
  const next = structuredClone(instance), index = next.tasks.findIndex(t => t.taskId === taskId), task = next.tasks[index];
  if (!task || !["ready", "in_progress"].includes(task.status)) throw new Error("현재 완료할 수 없는 Task입니다.");
  task.status = "completed"; task.startedAt ||= now(); task.completedAt = now();
  unlockEligibleTasks(next);
  if (next.tasks.every(item => item.status === "completed")) { next.status = "completed"; next.completedAt = now(); }
  next.updatedAt = now(); next.history.unshift(event("task_completed", `“${getTaskDefinition(next, taskId).title}” 업무를 완료했습니다.`)); return next;
}

function connectedTaskIds(instance, taskId) {
  const result = new Set([taskId]);
  let changed = true;
  while (changed) {
    changed = false;
    instance.definitionSnapshot.tasks.forEach(definition => {
      if (!result.has(definition.id) && definition.dependencies.some(id => result.has(id))) {
        result.add(definition.id); changed = true;
      }
    });
  }
  return result;
}

export function resetTask(instance, taskId, scope = "task") {
  if (!getTaskDefinition(instance, taskId)) throw new Error("Reset할 Task를 찾을 수 없습니다.");
  if (!["task", "downstream"].includes(scope)) throw new Error("유효하지 않은 Reset 범위입니다.");
  const next = structuredClone(instance);
  const targetIds = scope === "downstream" ? connectedTaskIds(next, taskId) : new Set([taskId]);
  next.tasks.filter(task => targetIds.has(task.taskId)).forEach(task => {
    task.checklist.forEach(item => { item.checked = false; });
    task.subtasks.forEach(item => { item.completed = false; });
    task.startedAt = null;
    task.completedAt = null;
    task.status = "blocked";
  });
  next.tasks.filter(task => targetIds.has(task.taskId)).forEach(task => {
    const definition = getTaskDefinition(next, task.taskId);
    task.status = definition.dependencies.every(id => next.tasks.find(item => item.taskId === id)?.status === "completed") ? "ready" : "blocked";
  });
  next.status = "active";
  next.completedAt = null;
  next.updatedAt = now();
  const title = getTaskDefinition(next, taskId).title;
  const range = scope === "downstream" ? `연결된 후속 Task 포함 ${targetIds.size}개` : "현재 Task만";
  next.history.unshift(event("task_reset", `“${title}”을(를) Reset했습니다. (${range})`));
  return next;
}

export function reconcileInstanceStructure(instance, message = "실행 중 Workflow 절차를 수정했습니다.") {
  const next = structuredClone(instance);
  const previous = new Map(next.tasks.map(task => [task.taskId, task]));
  next.tasks = next.definitionSnapshot.tasks.map(definition => {
    const current = previous.get(definition.id);
    const task = current || { taskId: definition.id, status: "blocked", startedAt: null, completedAt: null, subtasks: [], checklist: [] };
    const subtaskState = new Map((task.subtasks || []).map(item => [item.itemId, item.completed]));
    const checklistState = new Map((task.checklist || []).map(item => [item.itemId, item.checked]));
    task.subtasks = definition.subtasks.map(item => ({ itemId: item.id, completed: subtaskState.get(item.id) || false }));
    task.checklist = definition.checklist.map(item => ({ itemId: item.id, checked: checklistState.get(item.id) || false }));
    return task;
  });
  next.tasks.forEach(task => {
    if (task.status === "completed") return;
    const definition = getTaskDefinition(next, task.taskId);
    const eligible = definition.dependencies.every(id => next.tasks.find(item => item.taskId === id)?.status === "completed");
    if (!eligible) task.status = "blocked";
    else if (task.status !== "in_progress") task.status = "ready";
  });
  const allCompleted = next.tasks.length > 0 && next.tasks.every(task => task.status === "completed");
  next.status = allCompleted ? "completed" : "active";
  next.completedAt = allCompleted ? (next.completedAt || now()) : null;
  next.updatedAt = now();
  next.history.unshift(event("workflow_edited", message));
  return next;
}
export const progressOf = instance => instance.tasks.length ? Math.round(instance.tasks.filter(t => t.status === "completed").length / instance.tasks.length * 100) : 0;
