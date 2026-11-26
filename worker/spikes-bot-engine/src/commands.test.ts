import assert from "node:assert/strict";
import test from "node:test";
import { calculate } from "./calculator.js";
import { executeCommand, formatFancy, getCommandCatalog, parseCommand } from "./commands.js";

const context = { prefix: ".", uptimeSeconds: 3723, connected: true, ownerJid: "254700000000@s.whatsapp.net", ownerLabel: "Ghost Primo", repositoryUrl: "https://github.com/example/project" };

test("parser requires prefix and preserves arguments", () => {
  assert.equal(parseCommand("hello", "."), null);
  assert.deepEqual(parseCommand(".calc 2 + 3"), { name: "calc", args: ["2", "+", "3"], argumentText: "2 + 3" });
});

test("menu includes only enabled commands with required configuration", () => {
  const catalog = getCommandCatalog({ ...context, ownerJid: undefined, repositoryUrl: undefined }, { calc: false });
  const names = catalog.filter((item) => item.enabled && item.readiness === "ready").map((item) => item.name);
  assert.equal(names.includes("calc"), false);
  assert.equal(names.includes("owner"), false);
  assert.equal(names.includes("repo"), false);
  assert.equal(names.includes("menu"), true);
});

test("menu and ping report real command behavior", () => {
  assert.match(executeCommand(".menu", context)?.text ?? "", /\.calc/);
  assert.equal(executeCommand(".ping", context, {}, 7)?.text, "SPIKES BOT is responding. Command processing: 7 ms.");
  assert.match(executeCommand(".alive", { ...context, connected: false })?.text ?? "", /not connected/);
});

test("calculator applies precedence and rejects executable input", () => {
  assert.equal(calculate("12 * (4 + 2)"), 72);
  assert.equal(calculate("2^3^2"), 512);
  assert.throws(() => calculate("1 / 0"), /zero/);
  assert.throws(() => calculate("process.exit()"), /Only numbers/);
});

test("fancy transforms supported letters and preserves other characters", () => {
  assert.equal(formatFancy("Ghost 42!"), "𝙂𝙝𝙤𝙨𝙩 𝟰𝟮!");
});

test("disabled commands cannot execute", () => {
  assert.match(executeCommand(".calc 1+2", context, { calc: false })?.text ?? "", /disabled/);
});