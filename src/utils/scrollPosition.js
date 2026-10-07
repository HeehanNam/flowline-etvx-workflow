const selectors = [".detail-panel", ".free-canvas-wrap", ".mindmap-wrap", ".task-modal", ".reset-modal", "textarea"];

function identity(element) {
  const form = element.closest("form") || element.querySelector("form");
  return [form?.dataset.form, form?.dataset.taskId, form?.dataset.scope, element.getAttribute("name")].join("|");
}

export function captureScroll(root, viewport = window) {
  return {
    x: viewport.scrollX, y: viewport.scrollY,
    panels: selectors.flatMap(selector => Array.from(root.querySelectorAll(selector), (element, index) => ({
      selector, index, identity: identity(element), top: element.scrollTop, left: element.scrollLeft
    })))
  };
}

export function restoreScroll(root, snapshot, viewport = window) {
  for (const panel of snapshot.panels) {
    const element = root.querySelectorAll(panel.selector)[panel.index];
    if (!element || identity(element) !== panel.identity) continue;
    element.scrollTop = panel.top;
    element.scrollLeft = panel.left;
  }
  viewport.scrollTo({ left: snapshot.x, top: snapshot.y, behavior: "instant" });
}
