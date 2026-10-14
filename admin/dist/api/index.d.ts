/** The admin API for screens and plugins: the request helper, its errors, and the mutation hook. */
export { CmsApiError, cmsFetch, errorText, isConflict } from "./client.js";
export type { CmsIssue } from "./error-message.js";
export { type CmsMutationOptions, useCmsMutation } from "./use-cms-mutation.js";
