import { createId } from "../utils/id.js";

export function createWorkflow(input = {}) {
  const now = new Date().toISOString();
  return {
    id: createId("wf"),
    name: input.name && input.name.trim() || "새 Workflow",
    description: input.description && input.description.trim() || "",
    owner: input.owner && input.owner.trim() || "",
    version: 1,
    createdAt: now,
    updatedAt: now,
    tasks: []
  };
}

export function createTask(input = {}) {
  return {
    id: createId("task"),
    title: input.title && input.title.trim() || "새 업무",
    assignee: input.assignee && input.assignee.trim() || "미지정",
    entry: input.entry && input.entry.trim() || "선행 업무 완료",
    instructions: input.instructions && input.instructions.trim() || "",
    exit: input.exit && input.exit.trim() || "필수 체크리스트 완료",
    priority: input.priority || "medium",
    dependencies: input.dependencies || [],
    position: input.position || null,
    subtasks: input.subtasks || [],
    checklist: input.checklist || []
  };
}

export function createChecklistItem(text = "", required = true) {
  return { id: createId("check"), text: text.trim() || "확인 항목", required };
}

export function createSubtask(title = "", required = true) {
  return { id: createId("subtask"), title: title.trim() || "새 Subtask", required };
}

export function normalizeState(state) {
  state.workflows.forEach(workflow => {
    const levels = new Map();
    const levelOf = task => {
      if (levels.has(task.id)) return levels.get(task.id);
      const parents = (task.dependencies || []).map(id => workflow.tasks.find(item => item.id === id)).filter(Boolean);
      const value = parents.length ? Math.max(...parents.map(levelOf)) + 1 : 0;
      levels.set(task.id, value); return value;
    };
    workflow.tasks.forEach(levelOf);
    workflow.tasks.forEach((task, index) => {
    if (!task.priority) task.priority = "medium";
    if (!task.subtasks) task.subtasks = [];
    if (!Array.isArray(task.dependencies)) task.dependencies = index ? [workflow.tasks[index - 1].id] : [];
    if (!task.position) {
      const level = levels.get(task.id) || 0;
      const row = workflow.tasks.filter(item => levels.get(item.id) === level).indexOf(task);
      task.position = { x: 80 + level * 320, y: 90 + row * 220 };
    }
  });});
  state.instances.forEach(instance => {
    instance.definitionSnapshot.tasks.forEach((task, index) => {
      if (!task.priority) task.priority = "medium";
      if (!task.subtasks) task.subtasks = [];
      if (!task.position) task.position = { x: 80 + index * 320, y: 90 };
      if (!Array.isArray(task.dependencies)) task.dependencies = index ? [instance.definitionSnapshot.tasks[index - 1].id] : [];
    });
    instance.tasks.forEach(runTask => {
      const definition = instance.definitionSnapshot.tasks.find(task => task.id === runTask.taskId);
      if (!runTask.subtasks) runTask.subtasks = definition.subtasks.map(item => ({ itemId: item.id, completed: false }));
    });
  });
  return state;
}

export function validateWorkflow(workflow) {
  const errors = [];
  if (!workflow.name || !workflow.name.trim()) errors.push("Workflow 이름이 필요합니다.");
  if (!workflow.tasks.length) errors.push("최소 한 개의 Task가 필요합니다.");
  workflow.tasks.forEach((task, index) => {
    if (!task.title || !task.title.trim()) errors.push(`${index + 1}번 Task 이름이 필요합니다.`);
    if (!task.checklist.length) errors.push(`${task.title}에 체크리스트가 필요합니다.`);
  });
  const ids = new Set(workflow.tasks.map(task => task.id));
  workflow.tasks.forEach(task => task.dependencies.forEach(id => {
    if (!ids.has(id)) errors.push(`${task.title}의 선행 Task 연결이 유효하지 않습니다.`);
  }));
  const visiting = new Set(), visited = new Set();
  function visit(id) {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const task = workflow.tasks.find(item => item.id === id);
    if (task && task.dependencies.some(visit)) return true;
    visiting.delete(id); visited.add(id); return false;
  }
  if (workflow.tasks.some(task => visit(task.id))) errors.push("Task 연결에 순환 관계가 있습니다. 선행 관계를 확인해 주세요.");
  return errors;
}
