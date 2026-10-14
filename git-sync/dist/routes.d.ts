export declare const status: {
    GET: import("@monti-cms/core/plugin/server").AdminHandler<{
        [x: string]: string;
    }>;
};
export declare const pull: {
    POST: import("@monti-cms/core/plugin/server").AdminHandler<Record<string, string>>;
};
export declare const flush: {
    POST: import("@monti-cms/core/plugin/server").AdminHandler<Record<string, string>>;
};
export declare const conflicts: {
    GET: import("@monti-cms/core/plugin/server").AdminHandler<Record<string, string>>;
};
export declare const resolve: {
    POST: import("@monti-cms/core/plugin/server").AdminHandler<Record<string, string>>;
};
/** GitHub's `push` webhook. Public: the signature is the check, and nothing else about the request is trusted. */
export declare const webhook: {
    POST: import("@monti-cms/core/plugin/server").PublicHandler<{
        [x: string]: string;
    }>;
};
