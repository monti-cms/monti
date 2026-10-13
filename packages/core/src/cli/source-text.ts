/**
 * Reading JavaScript and TypeScript source as text, just enough for the edits `monti init` makes and the checks `monti doctor` runs on files the app owns: skipping strings,
 * template literals and comments, matching brackets, and the code of a file without its comments and strings. It is not a parser; a file in a shape these cannot read is
 * left to the person.
 */

/** The index after the string, template literal or comment that starts at `index`; `index` itself when nothing of the kind starts there. */
export function skipLiteral(text: string, index: number): number {
	const ch = text[index];
	if (ch === "/" && text[index + 1] === "/") {
		const end = text.indexOf("\n", index);
		return end === -1 ? text.length : end;
	}
	if (ch === "/" && text[index + 1] === "*") {
		const end = text.indexOf("*/", index + 2);
		return end === -1 ? text.length : end + 2;
	}
	if (ch === '"' || ch === "'") {
		let i = index + 1;
		while (i < text.length && text[i] !== ch && text[i] !== "\n") i += text[i] === "\\" ? 2 : 1;
		return i + 1;
	}
	if (ch === "`") {
		let i = index + 1;
		while (i < text.length && text[i] !== "`") {
			if (text[i] === "\\") i += 2;
			else if (text[i] === "$" && text[i + 1] === "{") {
				const close = matchingClose(text, i + 1);
				i = close === -1 ? text.length : close + 1;
			} else i += 1;
		}
		return i + 1;
	}
	return index;
}

/**
 * The code of a file with its comments and the contents of its strings blanked out, except the module names of imports (after `from` or `require(`).
 * What is left is what the program does, so a search of it is not satisfied by a comment or a string that mentions the name.
 */
export function codeOf(text: string): string {
	let out = "";
	for (let i = 0; i < text.length; ) {
		const end = skipLiteral(text, i);
		if (end === i) {
			out += text[i];
			i += 1;
			continue;
		}
		const literal = text.slice(i, end);
		const isComment = literal.startsWith("//") || literal.startsWith("/*");
		const isModuleName = !isComment && /(?:\bfrom|\brequire\()\s*$/.test(out);
		out += isComment ? " " : isModuleName ? literal : " ";
		i = end;
	}
	return out;
}

/** The index of the bracket that closes the one at `open` (`(`, `[` or `{`), or `-1` when there is none. */
export function matchingClose(text: string, open: number): number {
	const pairs: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
	const stack: string[] = [];
	for (let i = open; i < text.length; ) {
		const skipped = skipLiteral(text, i);
		if (skipped !== i) {
			i = skipped;
			continue;
		}
		const ch = text[i] as string;
		if (pairs[ch]) stack.push(pairs[ch] as string);
		else if (ch === ")" || ch === "]" || ch === "}") {
			if (stack.pop() !== ch) return -1;
			if (stack.length === 0) return i;
		}
		i += 1;
	}
	return -1;
}
