const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

test("classic bundle resolves all modules before app startup", () => {
  const source = fs.readFileSync(path.join(__dirname, "../src/app.bundle.js"), "utf8");
  let loaded = false;
  const context = {
    window: { FlowlineCompatibility: {
      markModuleLoaded() { loaded = true; }, showStartupLoading() {}
    } },
    document: { querySelector: () => ({}) },
    // Leave API reads pending: this checks synchronous module initialization without modifying data.
    fetch: () => new Promise(() => {}),
    console
  };
  assert.doesNotThrow(() => vm.runInNewContext(source, context, { timeout: 1000 }));
  assert.equal(loaded, true);
});
