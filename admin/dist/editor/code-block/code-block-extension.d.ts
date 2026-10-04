/**
 * CMS code block. Allows text effect marks on the code text (`CODE_BLOCK_MARKS`); line effects and regex rules live in attributes (model.ts).
 * `source`/`sourceKey` are the loaded source and the model fingerprint at that time. If unchanged, the source is saved as is.
 * With `rawMode`, the code has annotations the editor cannot display, so even annotation lines are edited as source.
 */
export declare const CmsCodeBlock: import("@tiptap/core").Node<import("@tiptap/extension-code-block").CodeBlockOptions, any>;
