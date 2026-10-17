/**
 * Every error code the server answers with, and the HTTP status of each. One table: the HTTP layer reads the status of an error from here
 * (nothing else maps a code to a status), and `CmsError` only accepts these codes, so a typo or an unmapped code is a compile error.
 */
export const ERROR_STATUS = {
    // The request is malformed or names something that cannot exist.
    invalid_input: 400,
    invalid_reference: 400,
    invalid_schema: 400,
    unknown_collection: 400,
    unknown_format: 400,
    format_not_importable: 400,
    unsupported_media_type: 415,
    // The caller is not allowed.
    unauthorized: 401,
    forbidden: 403,
    schema_read_only: 403,
    // The thing does not exist, or the verb is not offered.
    not_found: 404,
    method_not_allowed: 405,
    // The write cannot be done in the state the data is in.
    conflict: 409,
    slug_conflict: 409,
    in_use: 409,
    key_name_taken: 409,
    key_in_use: 409,
    invalid_status: 409,
    folder_name_conflict: 409,
    translation_exists: 409,
    has_translations: 409,
    source_trashed: 409,
    schema_conflict: 409,
    /** A schema save would leave stored entries worse off and the request did not acknowledge those changes. */
    schema_unacknowledged: 409,
    upload_incomplete: 409,
    /** A plugin cannot do what was asked yet (a missing token, a branch that does not exist); its message says how to fix it. */
    precondition_failed: 409,
    // The content or the schema is understood but not acceptable.
    validation_failed: 422,
    publish_validation_failed: 422,
    invalid_slug_format: 422,
    slug_too_long: 422,
    field_too_long: 422,
    invalid_metadata_key: 422,
    invalid_metadata_type: 422,
    invalid_metadata_value: 422,
    invalid_transforms: 422,
    format_import_failed: 422,
    unknown_op: 422,
    too_many_items: 422,
    // A version is needed to write.
    version_required: 428,
    rate_limited: 429,
    // Too big.
    body_too_large: 413,
    metadata_too_large: 413,
    payload_too_large: 413,
    too_many_pixels: 413,
    // The server or a service it depends on cannot do it.
    internal_error: 500,
    invalid_state: 500,
    format_export_failed: 500,
    hook_failed: 500,
    schema_apply_failed: 500,
    media_not_configured: 501,
    secret_not_configured: 501,
    /** A service the server calls (GitHub, an AI provider) failed. */
    upstream_failed: 502,
    service_unavailable: 503,
    unavailable: 503,
    // A setup mistake (`SetupError`): the server log says how to fix it.
    setup_required: 503,
    database_unreachable: 503,
    database_login_failed: 503,
    database_missing: 503,
    database_ssl: 503,
    database_url_invalid: 503,
    migrations_pending: 503,
    database_outdated: 503,
    database_url_missing: 503,
    config_missing: 503,
    schema_missing: 503,
    schema_invalid: 503,
};
/** Codes whose message is kept out of the response (an invariant broke; the server log has it). */
export const HIDDEN_MESSAGE_CODES = new Set(["invalid_state"]);
