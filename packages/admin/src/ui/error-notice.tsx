import { useTranslator } from "@monti-cms/core/site";
import type * as React from "react";
import type { ErrorNotice as Notice } from "../api/client";
import { cn } from "../lib/utils";
import { uiMessages } from "./messages";

/**
 * An error as the person reads it: what went wrong, what to do (when known), and the developer text folded under "Details".
 * Build the notice with `errorNotice()` of `@monti-cms/admin`.
 */
function ErrorNoticeView({ notice, className, ...props }: React.ComponentProps<"div"> & { notice: Notice }) {
	const t = useTranslator(uiMessages);
	return (
		<div
			role="alert"
			data-slot="error-notice"
			className={cn("flex flex-col gap-monti-4 text-monti-caption text-monti-danger", className)}
			{...props}
		>
			<p className="whitespace-pre-wrap">{notice.message}</p>
			{notice.fix && <p className="text-monti-muted">{notice.fix}</p>}
			{notice.detail && (
				<details className="text-monti-muted">
					<summary className="cursor-pointer select-none">{t("error.details")}</summary>
					<pre className="mt-monti-4 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded-monti-md bg-monti-tool p-monti-8 font-mono text-monti-caption">
						{notice.detail}
					</pre>
				</details>
			)}
		</div>
	);
}

export { ErrorNoticeView };
