// Marks a part draws are not typed into words (docs/design/admin/components/button.md, menu.md). `check:design` runs this over the screens (the
// admin's, the plugins' and the reference screens of `packages/ui/src/screens`) and the message dictionaries, as three rules:
//
// - `typed-glyph`: a word that starts with "+ " ("+ 새 글": the button takes the `Add` icon), a lone "×" or "✕" (the part draws its close mark), a
//   key typed as text ("Del", "⌫", "⌦", or "⌘", "⇧", "⌥" anywhere in it: `MenuShortcut keys` and `TooltipContent shortcut` write keys for the
//   system the admin runs on). Read in string literals, template literals and JSX text; comments are not read.
// - `button-title`: a `title` attribute on `Button`, `TextButton` or `IconButton`. The browser's own tooltip comes late, looks like no part of the
//   admin and is not read on focus; a button says more in a `Tooltip` (an `IconButton` has one from its `label`).
// - `chevron-off`: `chevron={false}`. A row that opens a second level ends in its › and says its current value in a `MenuValue` (menu.md).
//
// What it cannot see:
// - a mark that reaches the words as a value from somewhere else: a dictionary outside the checked files, a value built at runtime ("+" joined to
//   a label in two pieces), an icon font, a character typed in an image.
// - a "+" that is not followed by a space ("+1", "+언어"), or a key spelled out in words ("Delete key").
// - a `title` reaching a button through a spread (`{...props}`) or through a part that renders a button (`render={<Button />}` passes it on).
// - a row without its › drawn some other way than `chevron={false}`.
let parseSync = () => {
	throw new Error("oxc-parser is not installed (pnpm install)");
};
try {
	({ parseSync } = await import("oxc-parser"));
} catch {
	// Said when a file is read.
}

/** The keys a person presses, typed as glyphs or as their short names. */
const KEY_GLYPH = /[⌘⇧⌥⌫⌦]/;
const KEY_WORD = /^(?:Del|Backspace|Esc)$/;
/** A close mark typed as a letter. */
const CLOSE_MARK = /^[×✕✖]$/;
const BUTTONS = new Set(["Button", "TextButton", "IconButton"]);

/**
 * What is wrong with these words, or `null`. `shown`: the words are surely on the screen (JSX text, a JSX value, a dictionary's word), so a key's
 * name alone ("Del") is a typed key; elsewhere it is code comparing a key (`event.key === "Backspace"`).
 */
export function glyphOf(words, shown = true) {
	const text = words.trim();
	if (text === "") return null;
	if (/^\+ \S/.test(text)) return 'a "+" typed before a label: give the button the `Add` icon (button.md)';
	if (CLOSE_MARK.test(text)) return 'a typed "×": the part draws its own close mark (`Close` icon)';
	if (KEY_GLYPH.test(text) || (shown && KEY_WORD.test(text)))
		return "a key typed as text: pass the keys to `MenuShortcut keys` or `TooltipContent shortcut` (menu.md)";
	return null;
}

const lineOf = (text, offset) => text.slice(0, offset).split("\n").length;
const nameOf = (jsxName) => (jsxName?.type === "JSXIdentifier" ? jsxName.name : null);

/**
 * The problems in a set of sources (`{ path: text }`), as `{ file, line, rule, message }`. A file that does not parse says so as one problem, so a
 * file the rule cannot read is not passed in silence.
 */
export function problems(sources) {
	const found = [];
	for (const [file, text] of Object.entries(sources)) {
		const { program, errors } = parseSync(file, text);
		if (errors.length > 0) {
			found.push({
				file,
				line: 1,
				rule: "typed-glyph",
				message: "the file does not parse, so its words were not read",
			});
			continue;
		}
		const say = (node, rule, message) => found.push({ file, line: lineOf(text, node.start), rule, message });
		const dictionary = file.endsWith("/messages.ts");
		const words = (node, value, shown) => {
			const wrong = typeof value === "string" ? glyphOf(value, shown) : null;
			if (wrong) say(node, "typed-glyph", `${JSON.stringify(value.trim())}: ${wrong}`);
		};
		const walk = (node, parent = null) => {
			if (!node || typeof node !== "object") return;
			if (Array.isArray(node)) {
				for (const each of node) walk(each, parent);
				return;
			}
			if (typeof node.type !== "string") return;
			// What is checked is what a person reads: a module name or a type is not.
			if (node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration" || node.type.startsWith("TS"))
				return;
			const inJsx = parent?.type === "JSXExpressionContainer" || parent?.type === "JSXAttribute";
			if (node.type === "Literal") words(node, node.value, dictionary || inJsx);
			// A template is read whole, a value standing for each `${…}`: "+ ${label}" is a typed "+" all the same.
			else if (node.type === "TemplateLiteral") {
				words(
					node,
					node.quasis.map((quasi) => quasi.value?.cooked ?? quasi.value?.raw ?? "").join("…"),
					dictionary || inJsx,
				);
				for (const expression of node.expressions) walk(expression, node);
				return;
			} else if (node.type === "JSXText") words(node, node.value, true);
			else if (node.type === "JSXOpeningElement") {
				const name = nameOf(node.name);
				for (const attribute of node.attributes) {
					if (attribute.type !== "JSXAttribute") continue;
					const key = attribute.name?.name;
					if (key === "title" && BUTTONS.has(name))
						say(
							attribute,
							"button-title",
							`\`title\` on <${name}>: a button's tooltip is a \`Tooltip\`, not the browser's`,
						);
					if (
						key === "chevron" &&
						attribute.value?.type === "JSXExpressionContainer" &&
						attribute.value.expression?.type === "Literal" &&
						attribute.value.expression.value === false
					)
						say(attribute, "chevron-off", "`chevron={false}`: a row that opens a second level keeps its › (menu.md)");
				}
			}
			for (const [key, value] of Object.entries(node)) if (key !== "parent") walk(value, node);
		};
		walk(program);
	}
	return found;
}
