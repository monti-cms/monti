/** Stable error thrown by store implementations. The HTTP layer maps `code` to a status code. */
export class CmsError extends Error {
	public readonly code: string;
	public readonly serverVersion?: number;
	public readonly details?: unknown;

	constructor(message: string, code: string, serverVersion?: number, details?: unknown) {
		super(message);
		this.code = code;
		this.serverVersion = serverVersion;
		this.details = details;
		this.name = "CmsError";
	}
}
