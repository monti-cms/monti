declare const escapeRegExp: (value: string) => string;
export type CommentSyntax = {
    prefix: string;
    postfix: string;
};
export declare const resolveCommentSyntax: (lang: string) => CommentSyntax;
export declare const formatAnnotationComment: (commentSyntax: CommentSyntax, body: string) => string;
export declare const __testable__: {
    escapeRegExp: typeof escapeRegExp;
};
export {};
