import { CmsError } from "@monti-cms/core/plugin/server";
export class AiError extends CmsError {
    constructor(code, message) {
        super(message, code);
        this.name = "AiError";
    }
}
