// Marks a part draws are not typed into words (docs/design/admin/components/button.md, menu.md). `check:design` runs this over the screens (the
// admin's, the plugins' and the reference screens of `packages/ui/src/screens`) and the message dictionaries, as three rules:
//
// - `typed-glyph`: a word that starts with "+ " ("+ 새 글": the button takes the `Add` icon), a "×" or "✕" that is all a button says (the part draws its close mark; a "×" between two numbers is a size sign), a
//   key typed as text ("Del", "⌫", "⌦", or "⌘", "⇧", "⌥", "↵", "⏎" anywhere in it: `MenuShortcut keys` and `TooltipContent shortcut` write keys for the
//   system the admin runs on). Read in string literals, template literals and JSX text; comments are not read.
// - `button-title`: a `title` attribute on `Button`, `TextButton` or `IconButton`. The browser's own tooltip comes late, looks like no part of the
//   admin and is not read on focus; a button says more in a `Tooltip` (an `IconButton` has one from its `label`).
// - `chevron-off`: `chevron={false}`. A row that opens a second level ends in its › and says its current value in a `MenuValue` (menu.md).
//
// What it cannot see:
// - a mark that reaches the words as a value from somewhere else: a dictionary outside the checked files, a value built at runtime ("+" joined to
//   a label in two pieces), an icon font, a character typed in an image.
// - a "+" that is not followed by a space ("+1", "+언어"), or a key spelled out in words ("Delete key").
// - a key's name ("Del") in a value that reaches JSX from a variable or a function; glyphs ("⌘") are found anywhere.
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
const KEY_GLYPH = /[⌘⇧⌥⌫⌦↵⏎]/;
const KEY_WORD = /^(?:Del|Backspace|Esc)$/;
/** A close mark typed as a letter. */
const CLOSE_MARK = /^[×✕✖]$/;
const BUTTONS = new Set(["Button", "TextButton", "IconButton"]);
/** What a typed close mark would stand in: a button of the parts, or a plain one. */
const CLOSERS = new Set([...BUTTONS, "button"]);
/** Type syntax around a value: the value inside is read. */
const VALUE_WRAPPERS = new Set([
	"TSAsExpression",
	"TSSatisfiesExpression",
	"TSNonNullExpression",
	"TSInstantiationExpression",
]);

/**
 * What is wrong with these words, or `null`. `shown`: the words are surely on the screen (JSX text, a JSX value, a dictionary's word), so a key's
 * name alone ("Del") is a typed key; elsewhere it is code comparing a key (`event.key === "Backspace"`). `inButton`: the words are a button's
 * own content, where a lone "×" is a close mark typed.
 */
export function glyphOf(words, shown = true, inButton = false) {
	const text = words.trim();
	if (text === "") return null;
	if (/^\+ \S/.test(text)) return 'a "+" typed before a label: give the button the `Add` icon (button.md)';
	// A "×" between two numbers (a size: 800 × 600) is a sign of its own; one that is all a button says is the close mark typed.
	if (inButton && CLOSE_MARK.test(text)) return 'a typed "×": the part draws its own close mark (`Close` icon)';
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
		/** The JSX elements inside a button: a lone "×" in their text is the close mark typed. */
		const inButtons = new Set();
		const words = (node, value, shown) => {
			const wrong = typeof value === "string" ? glyphOf(value, shown, inButtons.has(node)) : null;
			if (wrong) say(node, "typed-glyph", `${JSON.stringify(value.trim())}: ${wrong}`);
		};
		/** The nodes whose value is drawn: a JSX value, and through it `&&`, `||`, `??`, a condition's branches and value wrappers. */
		const drawn = new Set();
		const shown = (node) => {
			if (!node || typeof node !== "object") return;
			drawn.add(node);
			if (node.type === "LogicalExpression") shown(node.right);
			else if (node.type === "ConditionalExpression") {
				shown(node.consequent);
				shown(node.alternate);
			} else if (VALUE_WRAPPERS.has(node.type) || node.type === "ParenthesizedExpression") shown(node.expression);
		};
		const walk = (node) => {
			if (!node || typeof node !== "object") return;
			if (Array.isArray(node)) {
				for (const each of node) walk(each);
				return;
			}
			if (typeof node.type !== "string") return;
			// What is checked is what a person reads: a module name or a type is not. A value inside `as`, `satisfies` or `!` is read.
			if (node.type === "ImportDeclaration" || node.type === "ExportAllDeclaration") return;
			if (node.type.startsWith("TS") && !VALUE_WRAPPERS.has(node.type)) return;
			// A key named for assistive technology is not drawn: it names the key, as code does.
			if (node.type === "JSXAttribute" && node.name?.name === "aria-keyshortcuts") return;
			// Words reach the screen through a condition too (`{open && "Del"}`, `{a ? "Esc" : null}`).
			if (node.type === "JSXExpressionContainer") shown(node.expression);
			if (node.type === "JSXAttribute") shown(node.value);
			const isShown = dictionary || drawn.has(node);
			if (node.type === "Literal") words(node, node.value, isShown);
			// A template is read whole, a value standing for each `${…}`: "+ ${label}" is a typed "+" all the same.
			else if (node.type === "TemplateLiteral") {
				words(node, node.quasis.map((quasi) => quasi.value?.cooked ?? quasi.value?.raw ?? "").join("…"), isShown);
				for (const expression of node.expressions) walk(expression);
				return;
			} else if (node.type === "JSXText") words(node, node.value, true);
			else if (node.type === "JSXElement" && CLOSERS.has(nameOf(node.openingElement.name))) {
				// The button's own words: its text, and the strings of its `{…}` children.
				for (const child of node.children)
					inButtons.add(child.type === "JSXExpressionContainer" ? child.expression : child);
			} else if (node.type === "JSXOpeningElement") {
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
			for (const [key, value] of Object.entries(node)) if (key !== "parent") walk(value);
		};
		walk(program);
	}
	return found;
}
