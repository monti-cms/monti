/** The admin API for screens and plugins: the request helper, its errors, and the mutation hook. */
export { type AdminFetchInit, adminFetch, apiErrorOf, CmsApiError, type ErrorNotice, errorNotice, errorText, isConflict, NoticeError, } from "./client.js";
export type { CmsIssue } from "./error-message.js";
export { apiErrorMessages } from "./error-message.messages.js";
export { useAdminFetch } from "./use-admin-fetch.js";
export { type CmsMutationOptions, useCmsMutation } from "./use-cms-mutation.js";
