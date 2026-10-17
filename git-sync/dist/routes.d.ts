export declare const status: {
    GET: import("@monti-cms/core/server").AdminHandler<{
        [x: string]: string;
    }>;
};
export declare const pull: {
    POST: import("@monti-cms/core/server").AdminHandler<Record<string, string>>;
};
export declare const flush: {
    POST: import("@monti-cms/core/server").AdminHandler<Record<string, string>>;
};
export declare const conflicts: {
    GET: import("@monti-cms/core/server").AdminHandler<Record<string, string>>;
};
export declare const resolve: {
    POST: import("@monti-cms/core/server").AdminHandler<Record<string, string>>;
};
/** GitHub's `push` webhook. Access `signed`: the signature is the check, and nothing else about the request is trusted. */
export declare const webhook: {
    POST: import("@monti-cms/core/server").PublicHandler<{
        [x: string]: string;
    }>;
};
