/**
 * Translation check reason messages. Keys are `StructureCheck`'s `code` (`mdx_error` puts the MDX parse error in `{message}`).
 * Sites override them with `admin.messages["cms.translation"]` in the config.
 */
export declare const translationMessages: import("../../index.js").MessageBundle<"mdx_error" | "source_unreadable" | "structure_changed" | "unreadable">;
