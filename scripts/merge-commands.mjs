/**
 * The pull request merges a shell command line would run, for the design review's merge hook (`check-review.mjs --hook`).
 *
 * It reads the line as a shell does, as far as a merge can hide: words and quotes, where one command ends and the next starts, what follows `if`,
 * `do`, `!`, `sudo`, `xargs` and the like, command substitutions, and the scripts a shell is given (`sh -c`, `eval`, a here-document, a
 * here-string, a pipe). Words that only mention a merge inside quotes (a commit message, a search) are not commands and are left alone.
 *
 * Where it cannot tell, it errs toward seeing a merge: `gh` anywhere among a command's words counts, so `echo gh pr merge 1` without quotes is
 * taken for one. It is not a shell, and what it does not see is: a merge made up at run time (a variable, a script file, a `gh` alias), the
 * GraphQL API under another name, a push straight to the branch, and the merge button on the pull request's page. The hook is there so that a merge
 * is not made by forgetting, not to stop someone set on it.
 */

/** A shell: it runs the word after `-c`, or what it is fed. */
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
/** The flags of `gh pr merge` that take the next word. */
const TAKES_VALUE = new Set([
	"-b",
	"--body",
	"-F",
	"--body-file",
	"-t",
	"--subject",
	"-A",
	"--author-email",
	"-R",
	"--repo",
	"--match-head-commit",
]);
const nameOf = (word) => word.split("/").pop();

/** The text from `from` up to the `)` that closes a `$(` opened just before it, and where that is. Parentheses inside quotes do not count. */
function substitution(text, from) {
	// The quote that is open at each depth: a `$(` inside quotes starts without one.
	const quotes = [null];
	for (let at = from; at < text.length; at++) {
		const char = text[at];
		const quote = quotes[quotes.length - 1];
		if (quote === "'") {
			if (char === "'") quotes[quotes.length - 1] = null;
		} else if (char === "\\") at++;
		else if (char === "$" && text[at + 1] === "(") {
			quotes.push(null);
			at++;
		} else if (quote === '"') {
			if (char === '"') quotes[quotes.length - 1] = null;
		} else if (char === "'" || char === '"') quotes[quotes.length - 1] = char;
		else if (char === "(") quotes.push(null);
		else if (char === ")") {
			quotes.pop();
			if (quotes.length === 0) return { inside: text.slice(from, at), end: at + 1 };
		}
	}
	return { inside: text.slice(from), end: text.length };
}

/** The commands inside the `$(…)` and backquotes of a text that is otherwise not commands (a here-document's body, when its word is not quoted). */
function substituted(text) {
	const found = [];
	for (let at = 0; at < text.length; at++) {
		if (text[at] === "\\") at++;
		else if (text[at] === "$" && text[at + 1] === "(") {
			const { inside, end } = substitution(text, at + 2);
			found.push(...commandsOf(inside));
			at = end - 1;
		} else if (text[at] === "`") {
			const end = text.indexOf("`", at + 1);
			const stop = end === -1 ? text.length : end;
			found.push(...commandsOf(text.slice(at + 1, stop)));
			at = stop;
		}
	}
	return found;
}

/**
 * The simple commands of a line, each as its words with the quotes taken off. A quoted word stays one word. The text of `$(…)` and of backquotes is read
 * as commands of its own, and so is a script a shell is given: the word after `-c`, the words after `eval`, a here-document or here-string, and the
 * words of the command piped into it.
 */
export function commandsOf(text) {
	/** Each command: its words, what it is fed on its input (here-documents, here-strings), and whether the command before pipes into it. */
	const commands = [];
	const loose = [];
	let current = { words: [], fed: [], piped: false };
	let word = null;
	let feeding = false;
	const endWord = () => {
		if (word !== null) (feeding ? current.fed : current.words).push(word);
		if (word !== null) feeding = false;
		word = null;
	};
	const endCommand = (piping = false) => {
		endWord();
		if (current.words.length > 0 || current.fed.length > 0) commands.push(current);
		current = { words: [], fed: [], piped: piping };
	};
	const heredocs = [];
	let quote = null;
	for (let at = 0; at < text.length; at++) {
		const char = text[at];
		if (quote === "'") {
			if (char === "'") quote = null;
			else word += char;
			continue;
		}
		if (char === "\\" && at + 1 < text.length) {
			// A backslash before a line's end joins the lines; before anything else it keeps the next character as it is.
			if (text[at + 1] !== "\n") word = (word ?? "") + text[at + 1];
			at++;
			continue;
		}
		if (char === "$" && text[at + 1] === "(") {
			const { inside, end } = substitution(text, at + 2);
			loose.push(...commandsOf(inside));
			word = `${word ?? ""}$()`;
			at = end - 1;
			continue;
		}
		if (char === "`") {
			const end = text.indexOf("`", at + 1);
			const stop = end === -1 ? text.length : end;
			loose.push(...commandsOf(text.slice(at + 1, stop)));
			word = `${word ?? ""}\`\``;
			at = stop;
			continue;
		}
		if (quote === '"') {
			if (char === '"') quote = null;
			else word += char;
			continue;
		}
		if (char === "'" || char === '"') {
			quote = char;
			word ??= "";
			continue;
		}
		if (char === "<" && text.startsWith("<<<", at)) {
			// A here-string: the next word is the command's input.
			endWord();
			feeding = true;
			at += 2;
			continue;
		}
		if (char === "<" && text[at + 1] === "<") {
			// A here-document: its body starts on the next line and ends at the line that is its word. With the word quoted the body is plain text.
			const found = /^<<-?\s*(\\?)(['"]?)([A-Za-z_][\w-]*)\2/.exec(text.slice(at));
			if (found) {
				endWord();
				heredocs.push({ ending: found[3], plain: found[1] !== "" || found[2] !== "", of: current });
				at += found[0].length - 1;
				continue;
			}
		}
		if (char === "\n") {
			for (const { ending, plain, of } of heredocs.splice(0)) {
				const rest = text.slice(at + 1);
				const last = new RegExp(`^[\\t ]*${ending}[\\t ]*$`, "m").exec(rest);
				const body = last ? rest.slice(0, last.index) : rest;
				of.fed.push(body);
				if (!plain) loose.push(...substituted(body));
				at = last ? at + last.index + last[0].length : text.length;
			}
			endCommand();
			continue;
		}
		if (char === "|") {
			// `|` and `|&` hand the output on; `||` only decides whether the next command runs.
			const or = text[at + 1] === "|";
			endCommand(!or);
			if (or || text[at + 1] === "&") at++;
			continue;
		}
		if (char === ";" || char === "&" || char === "(" || char === ")" || char === "{" || char === "}") {
			endCommand();
			continue;
		}
		if (char === " " || char === "\t") {
			endWord();
			continue;
		}
		if (char === "#" && word === null) {
			// A comment runs to the end of its line.
			const end = text.indexOf("\n", at);
			at = (end === -1 ? text.length : end) - 1;
			continue;
		}
		word = (word ?? "") + char;
	}
	// A here-document whose line never ended: its body is what is left, which is nothing.
	endCommand();
	const all = [...loose];
	commands.forEach((command, at) => {
		const { words, fed, piped } = command;
		all.push(words);
		words.forEach((each, here) => {
			if (nameOf(each) === "eval") all.push(...commandsOf(words.slice(here + 1).join(" ")));
			if (!SHELLS.has(nameOf(each))) return;
			const flag = words.findIndex((flagged, after) => after > here && /^-[A-Za-z]*c$/.test(flagged));
			if (flag !== -1 && words[flag + 1] !== undefined) all.push(...commandsOf(words[flag + 1]));
			// With no script of its own it runs what it is fed: its here-documents and here-strings, and what the command before it passes on
			// (the words it prints, the here-document it copies).
			else {
				const before = piped ? commands[at - 1] : undefined;
				for (const script of [...fed, ...(before?.words ?? []), ...(before?.fed ?? [])])
					all.push(...commandsOf(script));
			}
		});
	});
	return all.filter((words) => words.length > 0);
}

/**
 * The merges of a command line. `pull` is what names the pull request as it was written (a number, an address, a branch; `undefined` for the branch's own),
 * `repo` the `--repo` it was given, `head` the commit `--match-head-commit` binds it to. `how` is "api" for a merge through `gh api`, which this hook
 * cannot bind to a commit.
 */
export function mergesIn(text) {
	const merges = [];
	for (const words of commandsOf(text)) {
		// `gh` wherever it stands among the words: after `if`, `do`, `!`, `sudo -u me`, `env -i`, `timeout 60`, `xargs`.
		const gh = words.findIndex((each) => nameOf(each) === "gh");
		if (gh === -1) continue;
		const rest = words.slice(gh + 1);
		if (rest[0] === "api") {
			const path = rest.map((each) => /(?:repos\/([^/\s]+\/[^/\s]+)\/)?pulls\/(\d+)\/merge\b/.exec(each)).find(Boolean);
			if (path) merges.push({ how: "api", pull: path[2], repo: path[1] });
			else if (rest.some((each) => each.includes("mergePullRequest")))
				merges.push({ how: "api", pull: undefined, repo: undefined });
			continue;
		}
		// `gh [flags] pr merge …`: the first two words that are not flags.
		const named = [];
		let after = -1;
		for (let at = 0; at < rest.length && named.length < 2; at++) {
			if (rest[at] === "-R" || rest[at] === "--repo") at++;
			else if (!rest[at].startsWith("-")) {
				named.push(rest[at]);
				after = at;
			}
		}
		if (named[0] !== "pr" || named[1] !== "merge") continue;
		const merge = { how: "pr", pull: undefined, repo: undefined, head: undefined };
		const flagged = (name, value) => {
			if (name === "-R" || name === "--repo") merge.repo = value;
			if (name === "--match-head-commit") merge.head = value;
		};
		// A `--repo` before `pr` counts too.
		for (let at = 0; at < after; at++) if (rest[at] === "-R" || rest[at] === "--repo") flagged(rest[at], rest[at + 1]);
		for (let at = after + 1; at < rest.length; at++) {
			// Where its output goes is not what it merges: `> file`, `2>&1`.
			if (/^\d*[<>]/.test(rest[at])) {
				if (/^\d*[<>]+$/.test(rest[at])) at++;
				continue;
			}
			const [name, value] = rest[at].startsWith("--") && rest[at].includes("=") ? rest[at].split(/=(.*)/s) : [rest[at]];
			if (value !== undefined) flagged(name, value);
			else if (TAKES_VALUE.has(name)) flagged(name, rest[++at]);
			else if (!name.startsWith("-") && merge.pull === undefined) merge.pull = name;
		}
		merges.push(merge);
	}
	return merges;
}
