/** Stable error thrown by store implementations. The HTTP layer maps `code` to a status code. */
export class CmsError extends Error {
    code;
    serverVersion;
    details;
    constructor(message, code, serverVersion, details) {
        super(message);
        this.code = code;
        this.serverVersion = serverVersion;
        this.details = details;
        this.name = "CmsError";
    }
}
