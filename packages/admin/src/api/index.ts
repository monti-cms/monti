/** The admin API for screens and plugins: the request helper, its errors, and the mutation hook. */
export {
	adminFetch,
	apiErrorOf,
	CmsApiError,
	type ErrorNotice,
	errorNotice,
	errorText,
	isConflict,
	NoticeError,
} from "./client";
export type { CmsIssue } from "./error-message";
export { apiErrorMessages } from "./error-message.messages";
export { type CmsMutationOptions, useCmsMutation } from "./use-cms-mutation";
