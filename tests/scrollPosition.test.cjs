const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const source = fs.readFileSync(path.join(__dirname, "../src/utils/scrollPosition.js"), "utf8");
const modulePromise = import("data:text/javascript;base64," + Buffer.from(source).toString("base64"));

function panel(top, left, taskId) {
  return { scrollTop: top, scrollLeft: left,
    closest: () => null,
    querySelector: () => taskId ? { dataset: { form: "task", taskId, scope: "run" } } : null,
    getAttribute: () => null };
}

test("restores document, detail panel and canvas scroll after replacement", async () => {
  const { captureScroll, restoreScroll } = await modulePromise;
  let elements = { ".detail-panel": [panel(380, 0)], ".free-canvas-wrap": [panel(210, 560)] };
  const root = { querySelectorAll: selector => elements[selector] || [] };
  const viewport = { scrollX: 0, scrollY: 700, scrollTo: value => { viewport.restored = value; } };
  const snapshot = captureScroll(root, viewport);
  elements = { ".detail-panel": [panel(0, 0)], ".free-canvas-wrap": [panel(0, 0)] };
  restoreScroll(root, snapshot, viewport);
  assert.equal(elements[".detail-panel"][0].scrollTop, 380);
  assert.equal(elements[".free-canvas-wrap"][0].scrollLeft, 560);
  assert.equal(elements[".free-canvas-wrap"][0].scrollTop, 210);
  assert.equal(viewport.restored.top, 700);
});

test("does not apply an old task modal position to a different task", async () => {
  const { captureScroll, restoreScroll } = await modulePromise;
  let current = panel(420, 0, "task-a");
  const root = { querySelectorAll: selector => selector === ".task-modal" ? [current] : [] };
  const viewport = { scrollX: 0, scrollY: 0, scrollTo() {} };
  const snapshot = captureScroll(root, viewport);
  current = panel(0, 0, "task-b");
  restoreScroll(root, snapshot, viewport);
  assert.equal(current.scrollTop, 0);
});
