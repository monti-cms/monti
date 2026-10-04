const escapeRegExp = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const HASH_COMMENT_LANGS = new Set(["python", "yaml", "toml", "bash"]);
const SQL_COMMENT_LANGS = new Set(["sql"]);
const BLOCK_COMMENT_LANGS = new Set(["postcss"]);
export const resolveCommentSyntax = (lang) => {
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
export const formatAnnotationComment = (commentSyntax, body) => {
    const prefix = commentSyntax.prefix.trim();
    const postfix = commentSyntax.postfix.trim();
    return [prefix, body, postfix].filter((segment) => segment.length > 0).join(" ");
};
export const __testable__ = {
    escapeRegExp,
};
