// The rules that keep the admin's screens on its fixed parts (cause 10 of the admin QA audit: buttons, menus, icons and fields drawn again on every
// screen). `check:design` runs these as its rules `own-glyph`, `assistant-place`, `cut-words`, `menu-danger-separator`, `required-mark` and
// `mono-props`; each takes the sources it reads (`{ "packages/ui/src/x.tsx": text }`), so a test can hand it a made-up file. What each cannot see
// is written above it. An allow list names its files with the reason and fails when an entry no longer applies, so a list is only what is true.
let parseSync = () => {
	throw new Error("oxc-parser is not installed (pnpm install)");
};
try {
	({ parseSync } = await import("oxc-parser"));
} catch {
	// Said when a file is read.
}

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;
const keyOf = (file) => file.replace(/^packages\//, "");
const isCode = (file) => /\.tsx?$/.test(file) && !/\.(test|stories)\.tsx?$/.test(file);

/**
 * `own-glyph`: an icon or a mark the admin draws is a `@carbon/icons-react` icon from `icons.ts` (the rule `icon-list`) or one of the few marks
 * drawn by hand, because they are strokes tuned to a size no icon has. A file that writes `<svg` or builds an svg in the DOM is named here with
 * the reason; a new one is a design decision made in review.
 *
 * Cannot see: an icon taken from the list but the wrong one for its meaning (the same `Tag` for tags, people and series), an `<img>` or a CSS-drawn
 * mark, an svg that reaches the page as a string.
 */
export const OWN_GLYPH_OK = new Map([
	[
		"ui/src/caret.tsx",
		"the fold-out chevron after a text button: a 1.6px stroke at 12px, which no icon of the list has",
	],
	["ui/src/spark.tsx", "the assistant's one mark (proposal.md): filled, and not part of the icon set"],
	["ui/src/grip.tsx", "the drag handle's dots"],
	["ui/src/checkbox.tsx", "the check in the 14px box"],
	["ui/src/dropdown-menu.tsx", "the check in the box of a menu row that can be on with others"],
	[
		"admin/src/editor/plugins.ts",
		"the check in a check list's box, drawn in the editor's DOM, the same path as the checkbox",
	],
	["ui/src/screens/reference/media.tsx", "a sample picture's gradient (test data of a reference screen), not an icon"],
]);

export function ownGlyph(sources, { allowed = OWN_GLYPH_OK } = {}) {
	const found = [];
	const seen = new Set();
	for (const [file, source] of Object.entries(sources)) {
		if (!isCode(file) || !/^packages\/(ui|admin|ai|seo|mdx)\/src\//.test(file)) continue;
		if (!/svg/.test(source)) continue;
		// An svg is drawn in code, not named in a comment.
		const hit = OWN_GLYPH_CODE.exec(
			source.replace(/\/\*[\s\S]*?\*\/|(?<![:"'`])\/\/[^\n]*/g, (comment) => comment.replace(/[^\n]/g, " ")),
		);
		if (!hit) continue;
		seen.add(keyOf(file));
		if (!allowed.has(keyOf(file)))
			found.push({
				file,
				line: lineOf(source, hit.index),
				message:
					"a hand-drawn svg: take the icon from `@monti-cms/ui/icons`, or name this file in OWN_GLYPH_OK with the reason",
			});
	}
	for (const key of allowed.keys())
		if (!seen.has(key))
			found.push({ file: `packages/${key}`, line: 1, message: "OWN_GLYPH_OK names a file that draws no svg any more" });
	return found;
}

/**
 * `assistant-place`: the ✦ that opens the assistant is one part in one place (common.md): the admin reads its name `frame.assistant` in one file,
 * the reference screens draw it in one, `<AssistantButton` is written in `app.tsx` alone, and `SidebarInset` has no corner for it.
 *
 * Cannot see: a button that opens the assistant under another name, or a second ✦ drawn with the name written another way.
 */
export function assistantPlace(sources) {
	const found = [];
	const named = Object.entries(sources).filter(
		([file, source]) => isCode(file) && !file.endsWith("/messages.ts") && /["'`]frame\.assistant["'`]/.test(source),
	);
	if (named.length !== 1)
		found.push({
			file: named[0]?.[0] ?? "packages/admin/src/assistant/assistant-button.tsx",
			line: 1,
			message: `the ✦ button's name \`frame.assistant\` is read in ${named.length} files; it is one \`AssistantButton\` (common.md)`,
		});
	const reference = Object.entries(sources).filter(
		([file, source]) =>
			/\/screens\/reference\//.test(file) && !/\/frame\.tsx$/.test(file) && /label="어시스턴트 열기"/.test(source),
	);
	for (const [file, source] of reference)
		found.push({
			file,
			line: lineOf(source, source.search(/label="어시스턴트 열기"/)),
			message: "a second ✦ button: the reference screens take it from `ReferenceAssistant` (frame.tsx)",
		});
	// The button is given once, by the app, to `AssistantSlot`: a screen that draws `<AssistantButton` puts a second one on the page.
	for (const [file, source] of Object.entries(sources)) {
		if (!isCode(file) || /\/app\.tsx$/.test(file) || /\/assistant-button\.tsx$/.test(file)) continue;
		const hit = /<AssistantButton\b/.exec(source);
		if (hit)
			found.push({
				file,
				line: lineOf(source, hit.index),
				message: "`<AssistantButton` outside app.tsx: the ✦ is given once to `AssistantSlot` and drawn by the head row",
			});
	}
	for (const [file, source] of Object.entries(sources)) {
		const hit = /<SidebarInset\b[^>]*\bcorner\s*=/s.exec(source);
		if (hit)
			found.push({
				file,
				line: lineOf(source, hit.index),
				message: "`SidebarInset` has no corner: the ✦ ends the head row (`AssistantSlot`)",
			});
	}
	return found;
}

/**
 * `cut-words`: words cut to their box with "…" say themselves whole to the pointer and the keyboard (`CutWords`). In a part of the design system a
 * class that cuts (`truncate`, `text-ellipsis`, `line-clamp-N`) is written on a `<CutWords>` (its `className`, or the element it `render`s), or the
 * file is named here with the reason the words are cut some other way and said whole there.
 *
 * An attribute `CutWords` does not take (`data-slot`, `aria-current`) is named too: it would be dropped, and it belongs on the rendered element.
 *
 * Cannot see: a cut that a `<CutWords>` wraps from outside the class (a cell that cuts what a `CutWords` inside it holds), a box cut with no class of
 * its own (`overflow-hidden` alone), and a class built from pieces at run time. Whether a cut really shows its tooltip is the part's browser test (`menu-words.browser.test.tsx`).
 */
export const CUT_OK = new Map([
	["ui/src/cut-words.tsx", "the part itself"],
	[
		"ui/src/secret-input.tsx",
		"a key's masked trace (··· a1b2) is short and typed; nothing in it is cut in a field of a line's width",
	],
	[
		"ui/src/search-box.tsx",
		"the typed words of the search input, which an input scrolls: it is not words cut with a mark, and its chip is a `CutWords`",
	],
	[
		"ui/src/sidebar.tsx",
		"the selectors that cut a row's name (`[&>span]:truncate`); the row is a `CutWords`, which says the cut name, not the count beside it",
	],
	[
		"ui/src/table.tsx",
		"the cell's `truncate` class: a cell that cuts is itself a `CutWords` (`TableCell`), saying its `title` or its own words",
	],
	["ui/src/text.tsx", "the `truncate` option: `Text` and `Heading` put cut text in a `CutWords` themselves"],
	[
		"ui/src/entry-status.tsx",
		"a status name is one short fixed word; a table's cut cell says it whole through the cell's `title`",
	],
]);
const CUT_CLASS = /(?:^|[\s:])(?:truncate|text-ellipsis|line-clamp-\d)(?=\s|$)/;
const OWN_GLYPH_CODE = /<svg\b|createElementNS\s*\([^)]*svg/;
/**
 * The cut classes of a source that stand outside every `<CutWords ...>` opening (its `className`, or the element in its `render`): the strings
 * and template parts that write `truncate`, `text-ellipsis` or `line-clamp-N` anywhere else.
 */
function cutOutside(file, source) {
	const { program, errors } = parseSync(file, source);
	if (errors.length > 0) return [];
	const inside = [];
	const classes = [];
	walkTree(program, (node) => {
		if (node.type === "JSXOpeningElement" && nameOf(node.name) === "CutWords") inside.push([node.start, node.end]);
		if (node.type === "Literal" && typeof node.value === "string" && CUT_CLASS.test(node.value))
			classes.push(node.start);
		if (node.type === "TemplateElement" && CUT_CLASS.test(node.value?.cooked ?? "")) classes.push(node.start);
	});
	return classes.filter((at) => !inside.some(([from, to]) => at >= from && at <= to));
}

/**
 * The props `CutWords` takes. Any other attribute on it (`data-slot`, `aria-current`) is dropped without a word: TypeScript lets a hyphenated
 * attribute through on any component. The attributes go on the element it `render`s.
 */
const CUT_WORDS_PROPS = new Set(["render", "whole", "partial", "cut", "stop", "className", "children", "key"]);
/** The attributes on a `<CutWords ...>` opening that it does not take. */
function droppedOnCutWords(file, source) {
	const { program, errors } = parseSync(file, source);
	if (errors.length > 0) return [];
	const dropped = [];
	walkTree(program, (node) => {
		if (node.type !== "JSXOpeningElement" || nameOf(node.name) !== "CutWords") return;
		for (const each of node.attributes) {
			if (each.type !== "JSXAttribute") continue;
			const name =
				each.name?.type === "JSXNamespacedName"
					? `${each.name.namespace.name}:${each.name.name.name}`
					: each.name?.name;
			if (!CUT_WORDS_PROPS.has(name)) dropped.push({ at: each.start, name });
		}
	});
	return dropped;
}

export function cutWords(sources, { allowed = CUT_OK } = {}) {
	const found = [];
	const seen = new Set();
	for (const [file, source] of Object.entries(sources)) {
		if (isCode(file) && source.includes("<CutWords"))
			for (const { at, name } of droppedOnCutWords(file, source))
				found.push({
					file,
					line: lineOf(source, at),
					message: `\`${name}\` on CutWords is dropped: put it on the element CutWords renders (\`render={<span ${name}=… />}\`)`,
				});
		if (!isCode(file) || !file.startsWith("packages/ui/src/") || /\/spec-pack\//.test(file)) continue;
		if (!/truncate|text-ellipsis|line-clamp/.test(source)) continue;
		const outside = cutOutside(file, source);
		if (outside.length === 0) continue;
		seen.add(keyOf(file));
		if (allowed.has(keyOf(file))) continue;
		const hit = { at: outside[0] };
		found.push({
			file,
			line: lineOf(source, hit.at),
			message:
				"words are cut with no tooltip: put them in `CutWords` (or name this file in CUT_OK with the reason they are shown whole elsewhere)",
		});
	}
	for (const key of allowed.keys())
		if (!seen.has(key))
			found.push({
				file: `packages/${key}`,
				line: 1,
				message: "CUT_OK names a file that no longer cuts words with a class",
			});
	return found;
}

const walkTree = (node, visit) => {
	if (!node || typeof node !== "object") return;
	if (Array.isArray(node)) {
		for (const each of node) walkTree(each, visit);
		return;
	}
	if (typeof node.type !== "string") return;
	visit(node);
	for (const [key, value] of Object.entries(node)) if (key !== "parent") walkTree(value, visit);
};
const nameOf = (name) =>
	name?.type === "JSXIdentifier" ? name.name : name?.type === "JSXMemberExpression" ? name.property?.name : null;
const attrOf = (opening, key) =>
	opening.attributes.find((each) => each.type === "JSXAttribute" && each.name?.name === key);

/**
 * `menu-danger-separator`: in a menu, the row that cannot be undone ("to the trash", "remove") stands after a rule unless it is the first row
 * (menu.md). A `variant="danger"` menu item whose previous sibling is not a `*Separator` is named, and so are two `*Separator`s side by side. Stories
 * are read too: they are the menus the docs show. A menu in a file the rule does not reach (a package outside the admin) is not read.
 *
 * Cannot see: rows built from an array or by a component of their own (the file that draws the rows is read), a danger row that is itself inside a
 * condition (`{a ? <Item variant="danger"/> : …}`), a separator that a condition may leave out, and a menu whose first row is not the menu's start
 * (a fragment that comes after other rows).
 */
export function dangerSeparator(sources) {
	const found = [];
	for (const [file, source] of Object.entries(sources)) {
		// Stories are read too: they are the menus the docs show.
		if (!/\.tsx?$/.test(file) || /\.test\.tsx?$/.test(file) || !/^packages\/(ui\/src|admin|ai|seo|mdx)\//.test(file))
			continue;
		if (!/variant="danger"|Separator/.test(source)) continue;
		const { program, errors } = parseSync(file, source);
		if (errors.length > 0) {
			found.push({ file, line: 1, message: "the file does not parse, so its menus were not read" });
			continue;
		}
		walkTree(program, (node) => {
			if (node.type !== "JSXElement" && node.type !== "JSXFragment") return;
			const kids = node.children.filter(
				(child) =>
					!(child.type === "JSXText" && child.value.trim() === "") &&
					!(child.type === "JSXExpressionContainer" && child.expression?.type === "JSXEmptyExpression"),
			);
			kids.forEach((kid, at) => {
				if (kid.type !== "JSXElement") return;
				const opening = kid.openingElement;
				// Two rules in a row are one rule too many: whoever draws a menu's rows draws the rules between them, and a component owns none.
				if (/Separator$/.test(nameOf(opening.name) ?? "") && at > 0) {
					const before = kids[at - 1];
					if (before.type === "JSXElement" && /Separator$/.test(nameOf(before.openingElement.name) ?? ""))
						found.push({
							file,
							line: lineOf(source, kid.start),
							message: "two separators in a row in a menu (menu.md)",
						});
				}
				if (!/MenuItem$|^Item$/.test(nameOf(opening.name) ?? "")) return;
				const variant = attrOf(opening, "variant");
				if (variant?.value?.value !== "danger" || at === 0) return;
				const before = kids[at - 1];
				const text = source.slice(before.start, before.end);
				// A separator, or a condition that holds one (`{canStore ? (<>… <Separator /></>) : null}`).
				const rule =
					/Separator\b/.test(nameOf(before.openingElement?.name) ?? "") ||
					(before.type === "JSXExpressionContainer" && /Separator\b/.test(text));
				if (!rule)
					found.push({
						file,
						line: lineOf(source, kid.start),
						message: "a menu's danger row follows another row with no separator before it (menu.md)",
					});
			});
		});
	}
	return found;
}

/**
 * `required-mark`: the red `*` of a required field is `RequiredMark`, drawn by `Label` and `FieldRow`. No screen types it: not a " !" after a
 * name (in a template or a string such as "title !"), not a "*" or a lone "!" of its own in JSX text or a string, and no legend whose first mark is a
 * typed "!".
 *
 * Cannot see: a mark built at runtime from pieces, or a screen that draws its own star as an icon.
 */
export function requiredMark(sources) {
	const found = [];
	for (const [file, source] of Object.entries(sources)) {
		if (!isCode(file) || !/^packages\/(ui|admin|ai|seo|mdx)\/src\//.test(file)) continue;
		if (file.endsWith("/messages.ts")) {
			for (const hit of source.matchAll(
				/"[\w.]*[Rr]equired[\w.]*"\s*:\s*"! [^"]*"|"[\w.]*legend[\w.]*"\s*:\s*"! [^"]*"/g,
			))
				found.push({
					file,
					line: lineOf(source, hit.index),
					message: 'a legend that starts with a typed "!": a required field has the red `*` (`RequiredMark`)',
				});
			continue;
		}
		if (file.endsWith("/label.tsx") || !/ !["'`]|\}\s!`|>\s*[*!]\s*<|["'`]!["'`]/.test(source)) continue;
		const { program, errors } = parseSync(file, source);
		if (errors.length > 0) continue;
		walkTree(program, (node) => {
			if (
				node.type === "TemplateLiteral" &&
				node.quasis.length > 1 &&
				/^\s!$/.test(node.quasis.at(-1)?.value?.cooked ?? "")
			)
				found.push({
					file,
					line: lineOf(source, node.start),
					message: 'a required mark typed as " !": use `RequiredMark` (field.md, required fields)',
				});
			// A name written with its mark ("title !") or a mark alone ("!"): the field says `required`, the row draws the star.
			if (
				node.type === "Literal" &&
				typeof node.value === "string" &&
				(/^[\w.-]+ !$/.test(node.value) || node.value.trim() === "!")
			)
				found.push({
					file,
					line: lineOf(source, node.start),
					message: `${JSON.stringify(node.value)}: a required mark typed as "!": give the field \`required\` (\`RequiredMark\`, field.md)`,
				});
			if (node.type === "JSXText" && (node.value.trim() === "*" || node.value.trim() === "!"))
				found.push({
					file,
					line: lineOf(source, node.start),
					message: `a ${JSON.stringify(node.value.trim())} typed in JSX: the required mark is \`RequiredMark\``,
				});
		});
	}
	return found;
}

/**
 * `mono-props` (T276): Korean words are sans; mono is for values (tokens.md). `mono-words` looks for the class words, and this reads the part options
 * that turn mono on: `mono`, `metaMono`, `ofMono` on a tag. The tag's children and its `meta`, `of`, `value` and `defaultValue` are
 * read (an input's placeholder is words in the sans face by the part itself): a literal with a Hangul letter, or a `t("key")` whose Korean text has one, is a word set in mono. Children the rule cannot read (`{address}`,
 * `{code}`) are values it takes on trust only in a file named in `MONO_PROP_VALUES` with the reason, so a new place shows in the diff of this list.
 *
 * Cannot see: a variable that holds Korean words (`{item.label}` is a value only because its file says so), a part that sets mono from its own data,
 * and a dictionary text built with a plural or a select (only the literal parts of it are read).
 */
export const MONO_PROP_VALUES = new Map([
	["admin/src/assistant/prose.tsx", "the code of a fenced block in an answer"],
	["admin/src/editor/block-api.tsx", "the source of a block, typed text"],
	["admin/src/editor/code/code-view.tsx", "a code block's file name and its id"],
	["admin/src/editor/code/rules-card.tsx", "a rule's pattern, and the text it is typed as"],
	["admin/src/editor/media-views.tsx", "a picture's address"],
	["admin/src/screens/activity/activity-panel.tsx", "a field's old and new value, as stored"],
	["admin/src/screens/activity/activity-screen.tsx", "a time, digits"],
	["admin/src/screens/data/data-screen.tsx", "a size and a date, digits"],
	["admin/src/screens/entry/compare-view.tsx", "a code block's file name and the entry's address"],
	["admin/src/screens/entry/entry-editor.tsx", "the entry's address"],
	["admin/src/screens/entry/field-input.tsx", "a slug field: the typed address"],
	["admin/src/screens/keys/key-dialog.tsx", "the address typed in a key's window"],
	["admin/src/screens/list/taxonomy-screen.tsx", "an item's typed address (its slug or identifier)"],
	[
		"admin/src/screens/settings/basics-tab.tsx",
		'a collection\'s identifier and public address; the words for "no preview page" stay sans (`mono` only when it is an address)',
	],
	["admin/src/screens/settings/new-collection-sheet.tsx", "the new collection's identifier, typed"],
	["admin/src/screens/trash/trashed-item-panel.tsx", "the address of a trashed entry, in each language"],
	["admin/src/screens/keys/keys-screen.tsx", "a plugin's name, an identifier"],
	["admin/src/screens/list/import-sheet.tsx", "the names of fields in a file, as written there"],
	["admin/src/screens/list/list-screen.tsx", "a date, digits"],
	["admin/src/screens/media/media-screen.tsx", "a type, a size and a date, digits and extensions"],
	["admin/src/screens/settings/editor-tab.tsx", "the heading levels H2 to H4: letters and a digit, not words"],
	["admin/src/screens/settings/field-sheet.tsx", "an option's stored value, an identifier"],
]);
/** The option that turns mono on, and what it sets in mono: the tag's children and values (`mono`), its `meta` (`metaMono`), its `of` (`ofMono`). */
const MONO_PROPS = { mono: new Set(["value", "defaultValue"]), metaMono: new Set(["meta"]), ofMono: new Set(["of"]) };
const HANGUL = /[가-힣]/;

/** The Korean texts of message dictionaries (`{ "key": "text" }` after the dictionary's `ko:`), by key. */
export function koTexts(dictionaries) {
	const texts = new Map();
	for (const source of dictionaries) {
		const at = source.search(/\bko:\s*\{/);
		if (at < 0) continue;
		for (const hit of source.slice(at).matchAll(/"([\w.]+)"\s*:\s*"((?:[^"\\]|\\.)*)"/g)) texts.set(hit[1], hit[2]);
	}
	return texts;
}

export function monoProps(sources, { texts = new Map(), allowed = MONO_PROP_VALUES } = {}) {
	const found = [];
	const used = new Set();
	for (const [file, source] of Object.entries(sources)) {
		if (!isCode(file) || !/^packages\/(ui|admin|ai|seo|mdx)\/src\//.test(file) || file.endsWith("/messages.ts"))
			continue;
		if (!/\b(?:mono|metaMono|ofMono)\b/.test(source)) continue;
		// The screens (and the plugins') name what they cannot read; the parts of the design system take the option from their caller.
		const screen = !file.startsWith("packages/ui/");
		const { program, errors } = parseSync(file, source);
		if (errors.length > 0) continue;
		walkTree(program, (node) => {
			if (node.type !== "JSXElement") return;
			const opening = node.openingElement;
			const on = opening.attributes.find((each) => {
				if (each.type !== "JSXAttribute" || !(each.name?.name in MONO_PROPS)) return false;
				const value = each.value;
				return !(
					value?.type === "JSXExpressionContainer" &&
					value.expression?.type === "Literal" &&
					value.expression.value === false
				);
			});
			if (!on) return;
			const option = on.name.name;
			// `mono={condition}`: mono for some values only. It is not read as on.
			const conditional = on.value?.type === "JSXExpressionContainer" && on.value.expression?.type !== "Literal";
			let hangul = null;
			let unseen = conditional;
			const read = (expression) => {
				walkTree(expression, (inner) => {
					if (inner.type === "Literal" && typeof inner.value === "string" && HANGUL.test(inner.value))
						hangul ??= inner.value;
					if (inner.type === "CallExpression" && inner.callee?.name === "t" && inner.arguments[0]?.type === "Literal") {
						const text = texts.get(inner.arguments[0].value);
						if (text && HANGUL.test(text.replace(/\{[^}]*\}/g, ""))) hangul ??= text;
					}
				});
			};
			for (const attribute of opening.attributes) {
				if (attribute.type !== "JSXAttribute" || !MONO_PROPS[option].has(attribute.name?.name)) continue;
				if (attribute.value?.type === "Literal" && HANGUL.test(attribute.value.value)) hangul ??= attribute.value.value;
				if (attribute.value?.type === "JSXExpressionContainer") {
					read(attribute.value.expression);
					if (attribute.value.expression?.type !== "Literal") unseen = true;
				}
			}
			if (option === "mono") {
				for (const child of node.children) {
					if (child.type === "JSXText") {
						if (HANGUL.test(child.value)) hangul ??= child.value.trim();
					} else if (child.type === "JSXExpressionContainer") {
						read(child.expression);
						const call = child.expression?.type === "CallExpression" && child.expression.callee?.name === "t";
						if (!call && child.expression?.type !== "Literal") unseen = true;
					} else if (child.type === "JSXElement") unseen = true;
				}
				// A part with no children of its own (an input) shows what is typed in it, which is a value.
			}
			if (hangul && !conditional) {
				found.push({
					file,
					line: lineOf(source, node.start),
					message: `${JSON.stringify(hangul.slice(0, 24))} is words set in mono through \`${option}\`: words are sans, mono is for values (tokens.md)`,
				});
			} else if (unseen && screen) {
				used.add(keyOf(file));
				if (!allowed.has(keyOf(file)))
					found.push({
						file,
						line: lineOf(source, node.start),
						message: `\`${option}\` on words the check cannot read: name this file in MONO_PROP_VALUES with the reason they are values`,
					});
			}
		});
	}
	for (const key of allowed.keys())
		if (!used.has(key))
			found.push({
				file: `packages/${key}`,
				line: 1,
				message: "MONO_PROP_VALUES names a file with no mono option on values it cannot read",
			});
	return found;
}
