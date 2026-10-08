/**
 * Messages carried as `message` by snapshot validation (pre-publish checks). Error `code`s stay the same; the variant within a code is `params.reason`.
 * Sites override them with `admin.messages["cms.core"]` in the config.
 */
export declare const coreMessages: import("..").MessageBundle<"table.invalid_colspan" | "table.invalid_rowspan" | "table.ragged_rows" | "table.rowspan_overflow" | "table.span_overlap" | "table.span_too_large" | "untranslatedCount">;
/** The keys of the core dictionary. */
export type CoreMessageKey = keyof (typeof coreMessages)["messages"]["en"];
