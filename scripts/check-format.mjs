// Dates, times, file sizes and the names of languages are written by `packages/admin/src/format/` alone, so the same value reads the same on every
// screen (the year on a date of another year, "1 KB" for a small file, a language by its name and not its code in capitals). `check:design` runs
// this as its `format-only` rule over the admin's sources outside that folder (tests and stories are not read).
//
// What fails:
// - `Intl.DateTimeFormat`, `Intl.RelativeTimeFormat`, `Intl.DisplayNames` (also as `globalThis.Intl`): a date or a language's name built in a screen.
// - `.toLocaleDateString(…)`, `.toLocaleTimeString(…)`: the same, by the browser's own words.
// - `.padStart(…)`: a date or a time put together by hand ("0" before a month).
// - a date's part read inside a template (`${date.getMonth() + 1}. ${date.getDate()}`, or the `getUTC…` parts).
// - `.toUpperCase()`: a code shown in capitals in place of a name ("EN" for English, "PDF" from a file's name is `extensionLabel`).
//
// What it cannot see:
// - a date written without any of these: parts joined with `+` or `[..].join(".")`, `String(date)`, `date.toISOString().slice(0, 10)`,
//   `toLocaleString()` (numbers use it too, so it is not read), a date library.
// - a value that is already words when it reaches the screen: a date the server formatted, a raw id or an English word in a message's values.
// - a method reached under another name (`const up = String.prototype.toUpperCase`, `value["padStart"](2)` with a computed key that is not a
//   plain string, `const { DateTimeFormat } = Intl`).
// - whether a screen calls the right function of `format/` (a short date where the whole one is meant), or shows a raw value with no formatting
//   at all (a code as it is stored, bytes as a bare number).
// - the other packages that draw in the admin (`ai`, `seo`, `mdx`, a site's plugins): they do not reach `format/`, and are not read.
let parseSync = () => {
	throw new Error("oxc-parser is not installed (pnpm install)");
};
try {
	({ parseSync } = await import("oxc-parser"));
} catch {
	// Said when a file is read.
}

/** The folder that may format, and the sources the rule reads. */
export const FORMAT_DIR = "packages/admin/src/format/";
export const checked = (file) =>
	file.startsWith("packages/admin/src/") &&
	!file.startsWith(FORMAT_DIR) &&
	/\.tsx?$/.test(file) &&
	!/\.(test|stories)\.tsx?$/.test(file) &&
	!file.includes("/__test__/");

const INTL = new Set(["DateTimeFormat", "RelativeTimeFormat", "DisplayNames"]);
const LOCALE_CALLS = new Set(["toLocaleDateString", "toLocaleTimeString"]);
const DATE_PARTS = new Set(["getFullYear", "getMonth", "getDate", "getHours", "getMinutes", "getSeconds"]);
const UTC_PARTS = /^getUTC(FullYear|Month|Date|Hours|Minutes|Seconds)$/;
const GLOBALS = new Set(["globalThis", "window", "self"]);
/** `Intl`, or `globalThis.Intl` and its kin. */
const isIntl = (node) =>
	(node?.type === "Identifier" && node.name === "Intl") ||
	(/MemberExpression$/.test(node?.type ?? "") &&
		memberName(node) === "Intl" &&
		node.object?.type === "Identifier" &&
		GLOBALS.has(node.object.name));

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;
/** The name a member is read by: `a.name` or `a["name"]`. */
const memberName = (node) =>
	node.computed
		? node.property?.type === "Literal" && typeof node.property.value === "string"
			? node.property.value
			: null
		: (node.property?.name ?? null);

/** Every place in these sources (`{ file: text }`) that formats a value itself: `{ file, line, message }`. */
export function problems(sources) {
	const found = [];
	for (const [file, text] of Object.entries(sources)) {
		if (!checked(file)) continue;
		const { program, errors } = parseSync(file, text);
		// A file that cannot be read is not passed over: what is in it was not checked.
		if (errors.length > 0) {
			found.push({
				file,
				line: 1,
				message: `cannot be parsed (${errors[0]?.message ?? "syntax error"}): the rule could not read it.`,
			});
			continue;
		}
		const add = (node, message) => found.push({ file, line: lineOf(text, node.start), message });
		const walk = (node, inTemplate) => {
			if (!node || typeof node !== "object") return;
			if (Array.isArray(node)) {
				for (const each of node) walk(each, inTemplate);
				return;
			}
			if (typeof node.type !== "string") return;
			const member = node.type === "MemberExpression" || node.type === "StaticMemberExpression";
			if (member || node.type === "ComputedMemberExpression") {
				const name = memberName(node);
				if (isIntl(node.object) && INTL.has(name))
					add(node, `Intl.${name}: dates and language names are written by ${FORMAT_DIR} (date.ts, language.ts).`);
			}
			if (node.type === "CallExpression" && /MemberExpression$/.test(node.callee?.type ?? "")) {
				const name = memberName(node.callee);
				if (LOCALE_CALLS.has(name)) add(node, `.${name}(): a date is written by ${FORMAT_DIR}date.ts.`);
				if (name === "padStart")
					add(
						node,
						`.padStart(): a date or a time built by hand; use ${FORMAT_DIR}date.ts (clock, shortDate, isoDay).`,
					);
				if (name === "toUpperCase")
					add(
						node,
						`.toUpperCase(): a code in capitals is not a name; use ${FORMAT_DIR}language.ts (useLanguageName) or names.ts (extensionLabel).`,
					);
				if (inTemplate && (DATE_PARTS.has(name) || UTC_PARTS.test(name)))
					add(node, `.${name}() in a template: a date built by hand; use ${FORMAT_DIR}date.ts.`);
			}
			const inside = inTemplate || node.type === "TemplateLiteral";
			for (const key of Object.keys(node)) {
				if (key === "type" || key === "start" || key === "end") continue;
				walk(node[key], inside);
			}
		};
		walk(program, false);
	}
	return found;
}
