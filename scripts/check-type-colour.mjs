// The rules that keep the type roles, the screen mode and the colour tokens of the admin from coming apart again (cause 7, 13, 15 of the admin QA audit).
// `check:design` runs these as its rules `mono-words`, `type-order`, `tabular`, `screen-mode-root` and `token-contrast`; each takes the text it reads, so a test can
// hand it a made-up file. What each cannot see is written above it.
const lineOf = (source, index) => source.slice(0, index).split("\n").length;

/**
 * `mono-words`: `font-mono`, `text-monti-meta` and `text-monti-micro` are the places Korean words once came out in the mono face (the two small roles were
 * mono, so every word in them was). A file may use them only if it is named here with the reason, and the reason says which values stay mono. A name whose
 * file no longer uses any of them fails too, so the list is only what is true. The two small roles are sans now; `font-mono` on a span says "this is a value".
 *
 * Cannot see: whether a given child of a listed file is a number or a word. The reason carries that, and a person reading the diff of this list sees a new
 * place. A mono face set by another word (a `style` or `font-family` of its own) is the `off-system` rule's.
 */
export const MONO_OK = new Map([
	["ui/src/affix.tsx", "an affixed field is a typed value (an address with its fixed ends)"],
	["ui/src/block-bar.tsx", "the key of a tool in its hint, a typed mark"],
	["ui/src/calendar.tsx", "the weekday names are words in the small sans role"],
	[
		"ui/src/change.tsx",
		"the identifier of a change is mono; its tag and group labels are words in the small sans role",
	],
	["ui/src/chat-message.tsx", "the context line of a message is words in the small sans role"],
	["ui/src/code-block.tsx", "code"],
	["ui/src/code-frame.tsx", "code and its line numbers"],
	["ui/src/command.tsx", "group headings are words in the small sans role"],
	["ui/src/compare.tsx", "labels are words in the small sans role"],
	["ui/src/count.tsx", "a count is a number, mono"],
	["ui/src/description-list.tsx", "a count is mono; a quiet note after a value is words in the small sans role"],
	["ui/src/doc-blocks.tsx", "a number cell of a table of documentation, mono"],
	["ui/src/editor-body.tsx", "the editor's code, and the words of the small sans role in a block's label"],
	["ui/src/editor-overlay.tsx", "the kind of a block is a word in the small sans role"],
	["ui/src/error-box.tsx", "a raw error message as written"],
	["ui/src/field-tree.tsx", "field names and their counts are identifiers; a note is a word in the small sans role"],
	["ui/src/file-block.tsx", "a file's size is a value"],
	["ui/src/file-preview.tsx", "a file's extension is an identifier"],
	["ui/src/file-tree.tsx", "file names are typed identifiers"],
	["ui/src/heading-icon.tsx", "the level number on the heading icon"],
	["ui/src/input.tsx", "`mono` input: an address or an identifier"],
	["ui/src/language-row.tsx", "a language's code is an identifier"],
	["ui/src/list-section.tsx", "`metaMono`: a meta that is a date or a count"],
	["ui/src/locale-codes.tsx", "language codes are identifiers"],
	["ui/src/map-row.tsx", "a key of an import and a code are typed values"],
	["ui/src/marker.tsx", "a tag in a block's margin is a short code"],
	[
		"ui/src/menu-parts.tsx",
		"a row's typed address is mono; group labels and shortcuts are words in the small sans role",
	],
	["ui/src/model-menu.tsx", "a model's key is an identifier (`metaMono`)"],
	["ui/src/nav-link.tsx", "the count or identifier at the end of a row"],
	["ui/src/option-table.tsx", "the value column of an option table is a typed value"],
	["ui/src/page-header.tsx", "the meta after a title is a count or a date"],
	["ui/src/patch.tsx", "a file's path, its line counts and the changed code"],
	["ui/src/pick-list.tsx", "the mark at the end of a row is a short code"],
	["ui/src/property-list.tsx", "a section heading is a word in the small sans role"],
	["ui/src/proposal-bubble.tsx", "a count of changes with its arrows"],
	["ui/src/proposal-card.tsx", "a summary is words in the small sans role"],
	["ui/src/radio-group.tsx", "a description is words in the small sans role; a hint that is a typed value is mono"],
	["ui/src/secret-input.tsx", "a key is typed text"],
	["ui/src/sheet.tsx", "a title's count may be mono (`ofMono`)"],
	["ui/src/status-bar.tsx", "the status bar's words are in the small sans role"],
	["ui/src/table.tsx", "the address of a row's title is a typed value; a note is a word"],
	["ui/src/tag-input.tsx", "`mono` tags: identifiers"],
	["ui/src/text-button.tsx", "the `mono` option of a text button, and the small sans role for its words"],
	["ui/src/text.tsx", "the `mono` option of `Text`, and the roles"],
	["ui/src/textarea.tsx", "`mono` text: code and source"],
	["ui/src/tile.tsx", "the tile's detail line: numbers and words in the small sans role"],
	["ui/src/todo-item.tsx", "the tag of a to-do is a word in the small sans role"],
	["ui/src/tooltip.tsx", "a tooltip's key hint in the small sans role"],
	["ui/src/trash-row.tsx", "an address, a date and the days left are values"],
]);

/** The tokens `mono-words` looks for. */
const MONO_WORDS = /\b(?:font-mono|text-monti-meta|text-monti-micro)\b/g;

export function monoWords(sources, { allowed = MONO_OK, themeCss = "" } = {}) {
	const problems = [];
	const seen = new Set();
	for (const [file, source] of Object.entries(sources)) {
		const key = file.replace(/^packages\//, "");
		if (/\.(test|stories)\.tsx?$/.test(file)) continue;
		const first = [...source.matchAll(MONO_WORDS)][0];
		if (!first) continue;
		seen.add(key);
		if (!allowed.has(key))
			problems.push({
				file,
				line: lineOf(source, first.index),
				message: `\`${first[0]}\`: a file that draws mono or the small roles is named in MONO_OK with the reason (mono is for values; words are sans)`,
			});
	}
	for (const key of allowed.keys())
		if (!seen.has(key))
			problems.push({
				file: `packages/${key}`,
				line: 1,
				message: "MONO_OK names a file that no longer uses `font-mono`, `text-monti-meta` or `text-monti-micro`",
			});
	// The roles themselves: `meta` and `micro` are sans, so they set no mono family.
	for (const role of ["meta", "micro"]) {
		const block = new RegExp(`@utility text-monti-${role} \\{([^}]*)\\}`).exec(themeCss);
		if (block?.[1].includes("--monti-font-mono"))
			problems.push({
				file: "packages/ui/styles/theme.css",
				line: lineOf(themeCss, block.index),
				message: `text-monti-${role} sets the mono family: the small roles are sans, a value adds \`font-mono\``,
			});
	}
	return problems;
}

/**
 * `type-order`: the heading roles step down and none of the editor's headings is smaller than the text under it. From `tokens.json`: the sizes of
 * `display`, `page`, `heading`, `subheading` decrease, and `subheading` is at least `reading`. From the editor body: `h2`, `h3`, `h4` take roles whose sizes
 * decrease and stay at or above `reading`; an `h4` the size of the text is set apart by weight.
 *
 * Cannot see: a size set outside the roles (`off-system` stops those), or a heading drawn by another part than `EditorBody`.
 */
export function typeOrder(tokens, editorBody) {
	const problems = [];
	const sizes = new Map();
	const weights = new Map();
	for (const group of tokens.type.groups)
		for (const style of group.styles) {
			sizes.set(style.name.replace(/^text-/, ""), Number.parseFloat(style.fontSize));
			weights.set(style.name.replace(/^text-/, ""), style.fontWeight);
		}
	const chain = ["display", "page", "heading", "subheading", "reading"];
	for (let at = 1; at < chain.length; at++) {
		const [bigger, smaller] = [sizes.get(chain[at - 1]), sizes.get(chain[at])];
		if (bigger === undefined || smaller === undefined)
			problems.push({
				file: "packages/ui/tokens/tokens.json",
				line: 1,
				message: `the type role ${chain[at - 1] ?? ""} or ${chain[at]} is missing`,
			});
		else if (!(bigger > smaller) && !(chain[at] === "reading" && bigger === smaller))
			problems.push({
				file: "packages/ui/tokens/tokens.json",
				line: 1,
				message: `text-${chain[at]} (${smaller}px) is not smaller than text-${chain[at - 1]} (${bigger}px): the heading roles step down`,
			});
	}
	const reading = sizes.get("reading");
	let previous = Number.POSITIVE_INFINITY;
	for (const level of ["h2", "h3", "h4"]) {
		const found = new RegExp(`\\[&_${level}\\]:text-monti-([a-z-]+)`).exec(editorBody);
		if (!found) {
			problems.push({
				file: "packages/ui/src/editor-body.tsx",
				line: 1,
				message: `EditorBody gives ${level} no type role`,
			});
			continue;
		}
		const size = sizes.get(found[1]);
		const line = lineOf(editorBody, found.index);
		if (size === undefined)
			problems.push({
				file: "packages/ui/src/editor-body.tsx",
				line,
				message: `${level} takes an unknown role text-monti-${found[1]}`,
			});
		else {
			if (size > previous)
				problems.push({
					file: "packages/ui/src/editor-body.tsx",
					line,
					message: `${level} (${size}px) is larger than the heading above it (${previous}px)`,
				});
			if (size < reading)
				problems.push({
					file: "packages/ui/src/editor-body.tsx",
					line,
					message: `${level} (${size}px) is smaller than the text (${reading}px)`,
				});
			if (size === reading && !new RegExp(`\\[&_${level}\\]:font-semibold`).test(editorBody))
				problems.push({
					file: "packages/ui/src/editor-body.tsx",
					line,
					message: `${level} is the text's size and must be set apart by weight (font-semibold)`,
				});
			previous = size;
		}
	}
	return problems;
}

/**
 * `tabular`: digits are tabular wherever the admin is drawn. `admin.css` says `font-variant-numeric: tabular-nums` in the rule of `.monti-admin` and of the
 * body (popups are portaled to the body), and no source takes it back (`normal-nums`, `proportional-nums`).
 *
 * Cannot see: a number drawn in a face with no tabular digits, or an image of one.
 */
export function tabular(adminCss, sources = {}) {
	const problems = [];
	for (const selector of [".monti-admin", "html:has(.monti-admin) body"]) {
		const start = adminCss.indexOf(`\n${selector} {`);
		const block = start < 0 ? "" : adminCss.slice(start, adminCss.indexOf("}", start));
		if (!block.includes("font-variant-numeric: tabular-nums"))
			problems.push({
				file: "packages/ui/styles/admin.css",
				line: start < 0 ? 1 : lineOf(adminCss, start + 1),
				message: `the rule of \`${selector}\` does not say \`font-variant-numeric: tabular-nums\``,
			});
	}
	for (const [file, source] of Object.entries(sources)) {
		const found = /\b(?:normal-nums|proportional-nums)\b/.exec(source);
		if (found && !/\.(test|stories)\.tsx?$/.test(file))
			problems.push({
				file,
				line: lineOf(source, found.index),
				message: `\`${found[0]}\` takes back the admin's tabular digits`,
			});
	}
	return problems;
}
