/**
 * The pull request merges a shell command line would run, for the design review's merge hook (`check-review.mjs --hook`).
 *
 * It reads the line as a shell does, as far as a merge can hide: words and quotes, where one command ends and the next starts, command
 * substitutions, here-documents, and the scripts handed to `sh -c` and `eval`. Words that only mention a merge (a commit message, a search) are
 * not commands and are left alone. It is not a shell: a merge made up at run time (a variable, a script file) is not seen. The hook is there so
 * that a merge is not made by forgetting, not to stop someone set on it.
 */

/** A shell that runs its `-c` word, and the words that only come before a command. */
const SHELLS = new Set(["bash", "sh", "zsh", "dash", "ksh"]);
const BEFORE = new Set(["command", "exec", "time", "nohup", "sudo", "env", "builtin"]);
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

/**
 * The simple commands of a line, each as its words with the quotes taken off. A quoted word stays one word; the text of `$(…)` and of backquotes is read as
 * commands of its own; a here-document's body is skipped.
 */
export function commandsOf(text) {
	const commands = [];
	let words = [];
	let word = null;
	const endWord = () => {
		if (word !== null) words.push(word);
		word = null;
	};
	const endCommand = () => {
		endWord();
		if (words.length > 0) commands.push(words);
		words = [];
	};
	/** The text up to the `)` that closes a `$(` opened just before `from`, and where it ends. */
	const substitution = (from) => {
		let depth = 1;
		let at = from;
		for (; at < text.length && depth > 0; at++) {
			if (text[at] === "(") depth++;
			else if (text[at] === ")") depth--;
		}
		return { inside: text.slice(from, at - 1), end: at };
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
			const { inside, end } = substitution(at + 2);
			commands.push(...commandsOf(inside));
			word = (word ?? "") + "$()";
			at = end - 1;
			continue;
		}
		if (char === "`") {
			const end = text.indexOf("`", at + 1);
			const stop = end === -1 ? text.length : end;
			commands.push(...commandsOf(text.slice(at + 1, stop)));
			word = (word ?? "") + "``";
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
		if (char === "<" && text[at + 1] === "<" && text[at + 2] !== "<") {
			// A here-document: its body starts on the next line and ends at the line that is its word.
			const found = /^<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1/.exec(text.slice(at));
			if (found) {
				heredocs.push(found[2]);
				at += found[0].length - 1;
				continue;
			}
		}
		if (char === "\n") {
			endCommand();
			for (const ending of heredocs.splice(0)) {
				const body = new RegExp(`^[\\t ]*${ending}[\\t ]*$`, "m").exec(text.slice(at + 1));
				at = body ? at + 1 + body.index + body[0].length : text.length;
			}
			continue;
		}
		if (char === ";" || char === "&" || char === "|" || char === "(" || char === ")" || char === "{" || char === "}") {
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
	endCommand();
	// A shell given its script as a word, and `eval`, run that word's commands.
	return commands.flatMap((command) => {
		// What comes before the command's name is not it: `NAME=value`, `sudo`, `env`.
		const first = command.findIndex((each) => !/^[A-Za-z_]\w*=/.test(each) && !BEFORE.has(each));
		const run = first === -1 ? [] : command.slice(first);
		const name = (run[0] ?? "").split("/").pop();
		if (SHELLS.has(name)) {
			const flag = run.findIndex((each) => /^-[a-z]*c$/.test(each));
			return flag === -1 || run[flag + 1] === undefined ? [run] : [run, ...commandsOf(run[flag + 1])];
		}
		if (name === "eval") return [run, ...commandsOf(run.slice(1).join(" "))];
		return [run];
	});
}

/**
 * The merges of a command line. `pull` is what names the pull request as it was written (a number, an address, a branch; `undefined` for the branch's own),
 * `repo` the `--repo` it was given, `head` the commit `--match-head-commit` binds it to. `how` is "api" for a merge through `gh api`, which this hook
 * cannot bind to a commit.
 */
export function mergesIn(text) {
	const merges = [];
	for (const words of commandsOf(text)) {
		if ((words[0] ?? "").split("/").pop() !== "gh") continue;
		const rest = words.slice(1);
		const api =
			rest[0] === "api" &&
			rest.map((each) => /(?:repos\/([^/\s]+\/[^/\s]+)\/)?pulls\/(\d+)\/merge\b/.exec(each)).find(Boolean);
		if (api) {
			merges.push({ how: "api", pull: api[2], repo: api[1] });
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
