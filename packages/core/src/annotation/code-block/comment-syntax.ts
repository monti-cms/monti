const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export type CommentSyntax = {
	prefix: string;
	postfix: string;
};

const HASH_COMMENT_LANGS = new Set(["python", "yaml", "toml", "bash"]);
const SQL_COMMENT_LANGS = new Set(["sql"]);
const BLOCK_COMMENT_LANGS = new Set(["postcss"]);

export const resolveCommentSyntax = (lang: string): CommentSyntax => {
	const normalized = lang.trim().toLowerCase();

	if (HASH_COMMENT_LANGS.has(normalized)) {
		return { prefix: "#", postfix: "" };
	}

	if (SQL_COMMENT_LANGS.has(normalized)) {
		return { prefix: "--", postfix: "" };
	}

	if (BLOCK_COMMENT_LANGS.has(normalized)) {
		return { prefix: "/*", postfix: "*/" };
	}

	return { prefix: "//", postfix: "" };
};

export const formatAnnotationComment = (commentSyntax: CommentSyntax, body: string) => {
	const prefix = commentSyntax.prefix.trim();
	const postfix = commentSyntax.postfix.trim();

	return [prefix, body, postfix].filter((segment) => segment.length > 0).join(" ");
};

export const __testable__ = {
	escapeRegExp,
};
