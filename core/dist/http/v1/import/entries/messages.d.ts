/**
 * The text of the reasons an entry import gives for what it skipped, changed or could not do, in the admin language. A key is a reason code
 * (`ImportReasonCode`). Sites override the text with `admin.messages["cms.core.import"]` in the config.
 */
export declare const importMessages: import("../../../../index.js").MessageBundle<"body_unparsed" | "draft_missing" | "front_matter_invalid" | "images_left_out" | "item_collection" | "links_kept" | "locale_not_default" | "locale_unknown" | "no_body" | "no_collection" | "no_title" | "skipped_by_choice" | "slug_exists" | "slug_repeated" | "source_missing" | "source_skipped" | "title_from_slug" | "unexpected" | "unreadable" | "write_failed">;
