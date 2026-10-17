/**
 * Every error code the server answers with, and the HTTP status of each. One table: the HTTP layer reads the status of an error from here
 * (nothing else maps a code to a status), and `CmsError` only accepts these codes, so a typo or an unmapped code is a compile error.
 */
export declare const ERROR_STATUS: {
    readonly invalid_input: 400;
    readonly invalid_reference: 400;
    readonly invalid_schema: 400;
    readonly unknown_collection: 400;
    readonly unknown_format: 400;
    readonly format_not_importable: 400;
    readonly unsupported_media_type: 415;
    readonly unauthorized: 401;
    readonly forbidden: 403;
    readonly schema_read_only: 403;
    readonly not_found: 404;
    readonly method_not_allowed: 405;
    readonly conflict: 409;
    readonly slug_conflict: 409;
    readonly in_use: 409;
    readonly key_name_taken: 409;
    readonly key_in_use: 409;
    readonly invalid_status: 409;
    readonly folder_name_conflict: 409;
    readonly translation_exists: 409;
    readonly has_translations: 409;
    readonly source_trashed: 409;
    readonly schema_conflict: 409;
    /** A schema save would leave stored entries worse off and the request did not acknowledge those changes. */
    readonly schema_unacknowledged: 409;
    readonly upload_incomplete: 409;
    /** A plugin cannot do what was asked yet (a missing token, a branch that does not exist); its message says how to fix it. */
    readonly precondition_failed: 409;
    readonly validation_failed: 422;
    readonly publish_validation_failed: 422;
    readonly invalid_slug_format: 422;
    readonly slug_too_long: 422;
    readonly field_too_long: 422;
    readonly invalid_metadata_key: 422;
    readonly invalid_metadata_type: 422;
    readonly invalid_metadata_value: 422;
    readonly invalid_transforms: 422;
    readonly format_import_failed: 422;
    readonly unknown_op: 422;
    readonly too_many_items: 422;
    readonly version_required: 428;
    readonly rate_limited: 429;
    readonly body_too_large: 413;
    readonly metadata_too_large: 413;
    readonly payload_too_large: 413;
    readonly too_many_pixels: 413;
    readonly internal_error: 500;
    readonly invalid_state: 500;
    readonly format_export_failed: 500;
    readonly hook_failed: 500;
    readonly schema_apply_failed: 500;
    readonly media_not_configured: 501;
    readonly secret_not_configured: 501;
    /** A service the server calls (GitHub, an AI provider) failed. */
    readonly upstream_failed: 502;
    readonly service_unavailable: 503;
    readonly unavailable: 503;
    readonly setup_required: 503;
    readonly database_unreachable: 503;
    readonly database_login_failed: 503;
    readonly database_missing: 503;
    readonly database_ssl: 503;
    readonly database_url_invalid: 503;
    readonly migrations_pending: 503;
    readonly database_outdated: 503;
    readonly database_url_missing: 503;
    readonly config_missing: 503;
    readonly schema_missing: 503;
    readonly schema_invalid: 503;
};
export type ErrorCode = keyof typeof ERROR_STATUS;
/** Codes whose message is kept out of the response (an invariant broke; the server log has it). */
export declare const HIDDEN_MESSAGE_CODES: ReadonlySet<ErrorCode>;
