const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type CommentSyntax = {
	prefix: string;
	postfix: string;
};

const LINE_COMMENT: CommentSyntax = { prefix: "//", postfix: "" };

/**
 * Comment syntax per language, with the aliases of each language listed beside it.
 * A language that is not listed (js/ts/java/c/go/rust/php/scss/json5/text, ...) uses `//`.
 * `astro` is left out on purpose: a leading `<!-- -->` line would sit before its frontmatter fence.
 */
const COMMENT_SYNTAX_GROUPS: { syntax: CommentSyntax; langs: string[] }[] = [
	{
		syntax: { prefix: "#", postfix: "" },
		langs: [
			...["python", "py", "yaml", "yml", "toml", "bash", "sh", "shell", "zsh", "fish"],
			...["dockerfile", "docker", "ruby", "rb", "perl", "r", "makefile", "make", "nginx"],
			...["dotenv", "env", "powershell", "ps1", "graphql", "gql", "ini", "conf"],
			...["elixir", "julia", "nim", "coffee", "tcl"],
		],
	},
	{ syntax: { prefix: "--", postfix: "" }, langs: ["sql", "lua", "haskell", "hs", "elm", "ada"] },
	{
		syntax: { prefix: "<!--", postfix: "-->" },
		langs: ["html", "xml", "svg", "vue", "svelte", "markdown", "md", "mdx", "handlebars"],
	},
	{ syntax: { prefix: "/*", postfix: "*/" }, langs: ["css", "postcss"] },
	{ syntax: { prefix: ";", postfix: "" }, langs: ["lisp", "clojure", "clj", "scheme", "elisp", "asm", "nasm"] },
	{ syntax: { prefix: "%", postfix: "" }, langs: ["latex", "tex", "erlang", "matlab"] },
	{ syntax: { prefix: "%%", postfix: "" }, langs: ["mermaid"] },
];

const COMMENT_SYNTAX_BY_LANG = new Map<string, CommentSyntax>(
	COMMENT_SYNTAX_GROUPS.flatMap(({ syntax, langs }) => langs.map((lang) => [lang, syntax] as const)),
);

/** The comment syntax the writer uses for `lang`. */
export const resolveCommentSyntax = (lang: string): CommentSyntax =>
	COMMENT_SYNTAX_BY_LANG.get(lang.trim().toLowerCase()) ?? LINE_COMMENT;

/**
 * The comment syntaxes the parser accepts for `lang`: the language's own syntax first, then `//`.
 * Bodies stored before the table above was corrected hold `// @line ...` in every language.
 */
export const resolveParseCommentSyntaxes = (lang: string): CommentSyntax[] => {
	const own = resolveCommentSyntax(lang);
	return own === LINE_COMMENT ? [own] : [own, LINE_COMMENT];
};

export const formatAnnotationComment = (commentSyntax: CommentSyntax, body: string) => {
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();

	return [prefix, body, postfix].filter((segment) => segment.length > 0).join(" ");
};

export const __testable__ = {
	escapeRegExp,
};
