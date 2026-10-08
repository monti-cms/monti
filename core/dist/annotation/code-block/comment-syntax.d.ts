declare const escapeRegExp: (value: string) => string;
export type CommentSyntax = {
    prefix: string;
    postfix: string;
};
/** The comment syntax the writer uses for `lang`. */
export declare const resolveCommentSyntax: (lang: string) => CommentSyntax;
/**
 * The comment syntaxes the parser accepts for `lang`: the language's own syntax first, then `//`.
 * Bodies stored before the table above was corrected hold `// @line ...` in every language.
 */
export declare const resolveParseCommentSyntaxes: (lang: string) => CommentSyntax[];
export declare const formatAnnotationComment: (commentSyntax: CommentSyntax, body: string) => string;
export declare const __testable__: {
    escapeRegExp: typeof escapeRegExp;
};
export {};
