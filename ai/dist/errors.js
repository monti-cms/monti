import { CmsError } from "@monti-cms/core/server";
/**
 * An AI run that cannot be done. `what` (and `fix`) are the person's text in the admin language, from a dictionary; raw text from the provider, the
 * MDX parser or a schema goes in `detail`, never into `what`.
 */
export class AiError extends CmsError {
    constructor(code, what, options = {}) {
        // The developer message is the raw words when there are any (the answer's `detail`), else the person's text.
        super(options.detail ?? what, code, {
            issues: options.issues,
            notice: { what, ...(options.fix ? { fix: options.fix } : {}) },
        });
        this.name = "AiError";
    }
    /** The raw words underneath, when there are any. */
    get detail() {
        const notice = this.notice;
        return notice && "what" in notice && this.message === notice.what ? undefined : this.message;
    }
}
