// The prebuilt admin stylesheet must not touch the host's page (doc 16: the admin runs on the site's own pages). `node --test`.
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import { buildStyles, SCOPE, scopeSelector } from "./build-styles.mjs";

const postcss = createRequire(import.meta.url)("postcss");
const admin = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "packages", "admin");
const root = postcss.parse(await buildStyles(admin));

test("a selector goes under the document that holds the admin, with no added weight", () => {
	assert.equal(scopeSelector(".flex"), `${SCOPE} .flex`);
	assert.equal(scopeSelector(":root"), SCOPE);
	assert.equal(scopeSelector("html.dark body"), `${SCOPE}.dark body`);
	assert.equal(scopeSelector("html:has(.monti-admin) body"), "html:has(.monti-admin) body");
	assert.equal(scopeSelector(":host"), null);
});

test("16-1 every rule of the built stylesheet applies only where the admin is", () => {
	const loose = [];
	root.walkRules((rule) => {
		if (rule.parent?.type === "atrule" && /keyframes$/.test(rule.parent.name)) return;
		for (const selector of rule.selectors) if (!selector.includes(":has(.monti-admin)")) loose.push(selector);
	});
	assert.deepEqual(loose, []);
});

test("16-1 the built stylesheet declares only its own names: no layer, no host variable, no host keyframes", () => {
	const layers = [];
	root.walkAtRules("layer", (rule) => layers.push(rule.params));
	assert.deepEqual(layers, []);
	const foreign = new Set();
	root.walkDecls((decl) => {
		if (decl.prop.startsWith("--") && !decl.prop.startsWith("--monti-")) foreign.add(decl.prop);
	});
	root.walkAtRules("property", (rule) => {
		if (!rule.params.trim().startsWith("--monti-")) foreign.add(rule.params.trim());
	});
	assert.deepEqual([...foreign], []);
	const frames = [];
	root.walkAtRules(/keyframes$/, (rule) => {
		if (!rule.params.startsWith("monti-")) frames.push(rule.params);
	});
	assert.deepEqual(frames, []);
});

test("16-1 the built stylesheet has the admin's own classes, tokens and animations", () => {
	const css = root.toString();
	for (const needle of [
		".bg-monti-page",
		"--monti-bg-page:",
		".animate-spin",
		"@keyframes monti-spin",
		".h-monti-control",
	])
		assert.ok(css.includes(needle), `${needle} is missing`);
	// A story's or a test's own class is not shipped.
	assert.ok(!css.includes("group\\/move"));
});
