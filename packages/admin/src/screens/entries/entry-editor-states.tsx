"use client";

// The loading and load-error states of the entry editor screen.

import { useSite, useTranslator } from "@monti-cms/core/client";
import { AdminLink as Link } from "../../router";
import { Alert, AlertDescription } from "../../ui/alert";
import { buttonVariants } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";

export function EntryEditorLoading() {
	const t = useTranslator(entryEditorShellMessages);
	return (
		<div className="space-y-4 p-8" aria-busy>
			<span className="sr-only">{t("loadingDocument")}</span>
			<Skeleton className="h-8 w-1/2" />
			<Skeleton className="h-4 w-full" />
			<Skeleton className="h-4 w-5/6" />
		</div>
	);
}

export function EntryEditorLoadError({ message }: { message: string }) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	return (
		<div className="space-y-3 p-8">
			<Alert variant="destructive">
				<AlertDescription className="col-start-auto">{message}</AlertDescription>
			</Alert>
			<Link href={site.adminHref()} className={buttonVariants({ variant: "outline" })}>
				{t("backToList")}
			</Link>
		</div>
	);
}
