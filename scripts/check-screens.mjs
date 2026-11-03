// Checks every screen spec (`packages/*/src/**/*.screen.json`) against the catalog of the design system's parts (`pnpm gen:screen-catalog`), with the same
// `checkSpec` that `ScreenSpec` runs before it draws. Run from the repo root: `pnpm check:screens`, or `pnpm check:screens <file>…` for some files only.
// It prints each problem with its file, element and place (`login.screen.json: emailInput.props.variant: "big" is not a choice (…)`) and fails when there is one.
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
const { checkSpec } = await import(pathToFileURL(path.join(ROOT, "packages/ui/src/spec/check.ts")).href);
const catalog = JSON.parse(readFileSync(path.join(ROOT, "packages/ui/src/spec/screen-catalog.generated.json"), "utf8"));

function specs(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const file = path.join(dir, entry.name);
		if (entry.isDirectory()) return entry.name === "node_modules" || entry.name === "dist" ? [] : specs(file);
		return entry.name.endsWith(".screen.json") ? [file] : [];
	});
}

const files =
	process.argv.length > 2
		? process.argv.slice(2).map((file) => path.resolve(file))
		: specs(path.join(ROOT, "packages"));
let failed = 0;
for (const file of files) {
	const problems = checkSpec(JSON.parse(readFileSync(file, "utf8")), catalog);
	for (const problem of problems) console.error(`${path.relative(ROOT, file)}: ${problem}`);
	if (problems.length > 0) failed += 1;
}
if (failed > 0) process.exit(1);
console.log(`${files.length} screen spec${files.length === 1 ? "" : "s"}: no problems`);
