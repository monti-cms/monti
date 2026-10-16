import { useTranslator } from "@monti-cms/core/site";
import type * as React from "react";
import type { ErrorNotice as Notice } from "../api/client";
import { cn } from "../lib/utils";
import { uiMessages } from "./messages";

/**
 * An error as the person reads it: what went wrong, what to do (when known), and the developer text folded under "Details".
 * Build the notice with `errorNotice()` of `@monti-cms/admin/api`.
 */
function ErrorNoticeView({ notice, className, ...props }: React.ComponentProps<"div"> & { notice: Notice }) {
	const t = useTranslator(uiMessages);
	return (
		<div
			role="alert"
			data-slot="error-notice"
			className={cn("flex flex-col gap-1 text-cms-destructive text-xs", className)}
			{...props}
		>
			<p className="whitespace-pre-wrap">{notice.message}</p>
			{notice.fix && <p className="text-cms-muted-foreground">{notice.fix}</p>}
			{notice.detail && (
				<details className="text-cms-muted-foreground">
					<summary className="cursor-pointer select-none">{t("error.details")}</summary>
					<pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all rounded bg-cms-muted/40 p-2 font-mono text-[11px]">
						{notice.detail}
					</pre>
				</details>
			)}
		</div>
	);
}

export { ErrorNoticeView };
