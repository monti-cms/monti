// Checks every screen spec (`packages/*/src/**/*.screen.json`) against a design system pack's catalog (`pnpm gen:screen-catalog`), with the same
// `checkSpec` the renderer runs before it draws. Run from the repo root: `pnpm check:screens [--pack <dir>]`, or `pnpm check:screens <file>…` for some
// files only. It prints each problem with its file, element and place (`login.screen.json: emailInput.props.variant: "big" is not a choice (…)`) and
// fails when there is one.
//
// It also checks that the tool itself names no design system: no part, class, token or icon set of one in its files. Those belong in a pack.
import { readdirSync, readFileSync } from "node:fs";
import { registerHooks } from "node:module";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// The design system's sources import each other without an extension, as the bundler resolves them; Node runs them with their types stripped.
registerHooks({
	resolve(specifier, context, next) {
		if (specifier.startsWith(".") && !path.extname(specifier)) return next(`${specifier}.ts`, context);
		return next(specifier, context);
	},
});
const args = process.argv.slice(2);
const packAt = args.indexOf("--pack");
const PACK = path.resolve(ROOT, packAt === -1 ? "packages/ui/src/spec-pack" : args[packAt + 1]);
const pack = (await import(pathToFileURL(path.join(PACK, "pack.mjs")).href)).default;
const { checkSpec } = await import(pathToFileURL(path.join(ROOT, "packages/ui/src/spec/check.ts")).href);
const catalog = JSON.parse(readFileSync(path.join(PACK, pack.catalog), "utf8"));

/** The tool's own files: they read a design system from its pack and name none. */
const TOOL = [
	"packages/ui/src/spec",
	"scripts/check-screens.mjs",
	"scripts/gen-screen-catalog.mjs",
	"scripts/convert-board.mjs",
	"scripts/convert-board/html-adapter.js",
];
/** What would tie the tool to one design system: this repo's name or board classes, an icon set, a part it would draw by name. Built from pieces, so this line is not one. */
const TIED = [new RegExp(["mon" + "ti", "car" + "bon", "\\.m" + "t-"].join("|"), "i"), /"(Stack|Form|Button)"/];
const files = (target) =>
	readdirSync(target, { withFileTypes: true, recursive: true })
		.filter((entry) => entry.isFile())
		.map((entry) => path.join(entry.parentPath, entry.name));
const tied = [];
for (const target of TOOL.map((file) => path.join(ROOT, file))) {
	for (const file of target.endsWith("spec") ? files(target) : [target]) {
		readFileSync(file, "utf8")
			.split("\n")
			.forEach((line, index) => {
				if (TIED.some((pattern) => pattern.test(line)))
					tied.push(`${path.relative(ROOT, file)}:${index + 1}: ${line.trim()}`);
			});
	}
}
if (tied.length > 0) {
	console.error(
		`the screen spec tool names a design system; move this to the pack:\n${tied.map((line) => `  ${line}`).join("\n")}`,
	);
	process.exit(1);
}

function specs(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "dist" ? [] : specs(file);
		return entry.name.endsWith(".screen.json") ? [file] : [];
	});
}

const named = args.filter((arg, index) => arg !== "--pack" && args[index - 1] !== "--pack");
const screens = named.length > 0 ? named.map((file) => path.resolve(file)) : specs(path.join(ROOT, "packages"));
let failed = 0;
for (const file of screens) {
	const problems = checkSpec(JSON.parse(readFileSync(file, "utf8")), catalog);
	for (const problem of problems) console.error(`${path.relative(ROOT, file)}: ${problem}`);
	if (problems.length > 0) failed += 1;
}
if (failed > 0) process.exit(1);
console.log(`${screens.length} screen spec${screens.length === 1 ? "" : "s"}: no problems`);
