// Converts one state of an HTML board (a canvas `.dc.html` page) into a screen spec. The HTML part is only the adapter (`convert-board/html-adapter.js`);
// what it reads is tool-neutral and `toSpec` turns it into the spec, so another tool needs only an adapter of its own. Run from the repo root:
//
//   pnpm convert:board <board url> [--root .mt] [--dictionary <messages.ts>] [--out <file.screen.json>] [--compare <file.screen.json>]
//
// It prints what the board has outside the design system (a part it lacks, a space off the steps, a look shaped by hand) and fails while there is
// any: the spec is written only from a board drawn wholly inside the design system. `--compare` prints how the board's arrangement differs from a spec's.
import { readFileSync, writeFileSync } from "node:fs";
import { createRequire, registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const args = process.argv.slice(2);
const option = (name) => {
	const at = args.indexOf(`--${name}`);
	return at === -1 ? undefined : args[at + 1];
};
const url = args.find((arg, index) => !arg.startsWith("--") && !args[index - 1]?.startsWith("--"));
if (!url) {
	console.error(
		"usage: pnpm convert:board <board url> [--root .mt] [--dictionary <messages.ts>] [--out <file>] [--compare <file>]",
	);
	process.exit(2);
}

// The design system's sources import each other without an extension; a message dictionary imports `defineMessages`, which only returns what it is given.
registerHooks({
	resolve(specifier, context, next) {
		if (specifier === "@monti-cms/core")
			return {
				url: "data:text/javascript,export const defineMessages = (namespace, messages) => ({ namespace, messages });",
				shortCircuit: true,
			};
		if (specifier.startsWith(".") && !path.extname(specifier) && context.parentURL?.includes("/packages/ui/src/")) {
			return next(`${specifier}.ts`, context);
		}
		return next(specifier, context);
	},
});
const load = (file) => import(pathToFileURL(path.resolve(ROOT, file)).href);
const { toSpec } = await load("packages/ui/src/spec/convert/to-spec.ts");
const { compareStructure } = await load("packages/ui/src/spec/convert/compare.ts");
const { checkSpec } = await load("packages/ui/src/spec/check.ts");
const catalog = JSON.parse(readFileSync(path.join(ROOT, "packages/ui/src/spec/screen-catalog.generated.json"), "utf8"));

/** The Korean texts of a message dictionary, each pointing at its key. */
async function dictionaryOf(file) {
	if (!file) return {};
	const bundle = Object.values(await load(file)).find((value) => value?.messages?.ko);
	return Object.fromEntries(
		Object.entries(bundle?.messages.ko ?? {})
			.filter(([, text]) => typeof text === "string")
			.map(([key, text]) => [text, key]),
	);
}

const { chromium } = createRequire(path.join(ROOT, "package.json"))("playwright-core");
const browser = await chromium.launch();
let drawn;
try {
	const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
	await page.goto(url, { waitUntil: "networkidle" });
	await page.waitForTimeout(1000);
	await page.addScriptTag({ path: path.join(ROOT, "scripts/convert-board/html-adapter.js") });
	drawn = await page.evaluate((selector) => window.readBoard(selector), option("root") ?? ".mt");
} finally {
	await browser.close();
}

const { spec, outside, data } = toSpec(drawn, catalog, await dictionaryOf(option("dictionary")));
const problems = checkSpec(spec, catalog);
if (option("compare")) {
	const other = JSON.parse(readFileSync(path.resolve(option("compare")), "utf8"));
	const differences = compareStructure(spec, other);
	console.log(differences.length === 0 ? "same arrangement" : `arrangement differs in ${differences.length} places:`);
	for (const difference of differences) console.log(`  ${difference}`);
}
if (outside.length > 0) {
	console.error(`outside the design system (${outside.length}):`);
	for (const line of outside) console.error(`  ${line}`);
}
if (problems.length > 0 && outside.length === 0) {
	for (const problem of problems) console.error(`  ${problem}`);
}
if (option("out")) {
	const out = path.resolve(option("out"));
	writeFileSync(out, `${JSON.stringify(spec, null, "\t")}\n`);
	// The drawn texts no dictionary names, to draw the spec with until someone names them.
	writeFileSync(out.replace(/\.json$/, ".data.json"), `${JSON.stringify(data, null, "\t")}\n`);
	console.log(
		`wrote ${option("out")}${outside.length > 0 ? " (not a spec yet: the board is not inside the design system)" : ""}`,
	);
}
if (outside.length > 0 || problems.length > 0) process.exit(1);
