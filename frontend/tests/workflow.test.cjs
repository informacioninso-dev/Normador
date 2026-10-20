const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const ts = require("typescript");

// Exercise the same pure navigation helper shipped by Next, without a browser dependency.
const source = fs.readFileSync(path.join(__dirname, "../src/lib/workflow.ts"), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
const moduleContext = { exports: {} };
vm.runInNewContext(compiled, moduleContext);
const { suggestRequirementStep: suggest, requirementSupport: support } = moduleContext.exports;
const item = { id: 1, project: 100, requirement: 10, status: "NO_INICIADO", requires_document: true, requires_evidence: true };
const context = { canEdit: true, canValidate: false, hasDocuments: false, hasReview: false, pendingEvidence: false };

test("guidance respects backend state and does not infer closure from documentary progress", () => {
  assert.equal(suggest(item, context), "documents");
  assert.equal(suggest(item, { ...context, hasDocuments: true }), "review");
  assert.equal(suggest({ ...item, status: "VALIDADO_DOCUMENTALMENTE" }, context), "evidence");
  assert.equal(suggest({ ...item, status: "IMPLEMENTADO" }, context), "evidence");
  assert.equal(suggest({ ...item, status: "CERRADO" }, { ...context, pendingEvidence: true, canValidate: true }), "understand");
  assert.equal(item.status, "NO_INICIADO");
});

test("readers receive consultation advice and validators can inspect pending evidence", () => {
  assert.equal(suggest(item, { ...context, canEdit: false }), "understand");
  assert.equal(suggest(item, { ...context, canEdit: false, hasReview: true }), "review");
  assert.equal(suggest(item, { ...context, canEdit: false, canValidate: true, pendingEvidence: true }), "evidence");
});

test("requirements without formal documents still have a usable path", () => {
  assert.equal(suggest({ ...item, requires_document: false }, context), "evidence");
  assert.equal(suggest({ ...item, requires_document: false, requires_evidence: false }, context), "understand");
  assert.equal(suggest({ ...item, status: "OBSERVADO" }, { ...context, hasDocuments: true, hasReview: true }), "review");
});

test("a worksheet keeps supports in its project and chooses the latest applicable review", () => {
  const result = support(item, [
    { id: 1, project: 100, requirement: 10 }, { id: 2, project: 200, requirement: 10 },
  ], [
    { id: 1, project: 100, created_at: "2026-10-19", requirement_evaluations: [{ requirement: 10 }] },
    { id: 2, project: 100, created_at: "2026-10-20", requirement_evaluations: [{ requirement: 10 }] },
    { id: 3, project: 200, created_at: "2026-10-21", requirement_evaluations: [{ requirement: 10 }] },
  ], [
    { id: 1, project: 100, requirement: 10 }, { id: 2, project: 200, requirement: 10 },
  ]);
  assert.equal(result.documents.length, 1);
  assert.equal(result.evidences.length, 1);
  assert.equal(result.reviews.length, 2);
  assert.equal(result.reviews[0].id, 2);
});

test("evidence and commitment calendar dates keep their recorded day in Ecuador", () => {
  const previousTimezone = process.env.TZ;
  try {
    process.env.TZ = "America/Guayaquil";
    const source = fs.readFileSync(path.join(__dirname, "../src/lib/presentation.ts"), "utf8");
    const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 } }).outputText;
    const calendarContext = { exports: {} };
    vm.runInNewContext(compiled, calendarContext);
    const expected = new Intl.DateTimeFormat("es-EC", { dateStyle: "medium" }).format(new Date(2026, 9, 20));
    assert.equal(calendarContext.exports.formatDate("2026-10-20"), expected);
  } finally {
    if (previousTimezone === undefined) delete process.env.TZ;
    else process.env.TZ = previousTimezone;
  }
});
