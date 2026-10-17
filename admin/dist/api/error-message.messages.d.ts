/**
 * The errors the screen tells itself (offline, a preview, no media storage) and the heading of a list of issues.
 * The text of an error code comes from the server (`cms.core.errors`), and so does the text of each issue (`cms.core.issues`).
 */
export declare const apiErrorMessages: import("@monti-cms/core").MessageBundle<"fallback" | "mediaNotConfigured" | "network" | "previewNoWrite" | "validationFailedList">;
