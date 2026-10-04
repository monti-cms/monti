export const normalizeReferenceKind = (kind) => (kind === "media" ? "media" : "entry");
export class ServiceError extends Error {
    code;
    issues;
    constructor(code, issues) {
        super(code);
        this.code = code;
        this.issues = issues;
        this.name = "ServiceError";
    }
}
