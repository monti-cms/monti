"use client";

// The loading and load-error states of the entry editor screen.

import { useSite, useTranslator } from "@monti-cms/core/site";
import { AdminLink as Link } from "../../router";
import { Alert, AlertDescription } from "../../ui/alert";
import { buttonVariants } from "../../ui/button";
import { Skeleton } from "../../ui/skeleton";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";

export function EntryEditorLoading() {
	const t = useTranslator(entryEditorShellMessages);
	return (
		<div
			className="flex h-screen w-full flex-col overflow-hidden bg-monti-background text-monti-foreground"
			aria-busy="true"
		>
			<span className="sr-only">{t("loadingDocument")}</span>

			{/* Top Header skeleton */}
			<header className="flex h-14 shrink-0 items-center justify-between border-b bg-monti-background px-4">
				<div className="flex items-center gap-2">
					<Skeleton className="size-4 rounded-sm" />
					<Skeleton className="h-4 w-12 rounded-md" />
				</div>
				<div className="flex items-center gap-2.5">
					<Skeleton className="h-4 w-20 rounded-md" />
					<Skeleton className="h-8 w-16 rounded-md" />
					<Skeleton className="size-8 rounded-md" />
					<Skeleton className="size-8 rounded-md" />
				</div>
			</header>

			{/* Main Editor Canvas + Inspector Side Panel */}
			<div className="relative flex min-h-0 flex-1 overflow-hidden">
				{/* Canvas Area */}
				<div className="flex h-full min-w-0 flex-1 flex-col overflow-hidden">
					{/* Formatting Toolbar skeleton */}
					<div className="relative flex min-h-12 w-full shrink-0 items-center border-b bg-monti-background/95 px-6 py-2 backdrop-blur">
						<div className="flex min-w-0 flex-1 items-center justify-center gap-1.5">
							<Skeleton className="h-7 w-20 rounded-md" />
							<span className="mx-1 h-4 w-px bg-monti-border" />
							<div className="flex items-center gap-1">
								<Skeleton className="size-7 rounded-md" />
								<Skeleton className="size-7 rounded-md" />
								<Skeleton className="size-7 rounded-md" />
								<Skeleton className="size-7 rounded-md" />
								<Skeleton className="size-7 rounded-md" />
							</div>
							<span className="mx-1 h-4 w-px bg-monti-border" />
							<div className="flex items-center gap-1">
								<Skeleton className="size-7 rounded-md" />
								<Skeleton className="size-7 rounded-md" />
								<Skeleton className="size-7 rounded-md" />
							</div>
						</div>
						<div className="absolute inset-y-0 right-4 flex items-center gap-1">
							<Skeleton className="size-7 rounded-md" />
							<Skeleton className="size-7 rounded-md" />
						</div>
					</div>

					{/* Document Content Canvas */}
					<div className="h-full min-w-0 flex-1 overflow-y-auto px-6 py-10">
						<div className="mx-auto w-full max-w-[760px] space-y-6">
							{/* Language tabs skeleton */}
							<div className="flex items-center gap-2">
								<Skeleton className="h-6 w-20 rounded-full" />
								<Skeleton className="h-6 w-14 rounded-full" />
							</div>

							{/* Title skeleton */}
							<Skeleton className="h-10 w-3/4 rounded-md" />

							<div className="border-monti-border/60 border-b pt-1" />

							{/* Paragraph skeletons */}
							<div className="space-y-3 pt-4">
								<Skeleton className="h-4 w-full" />
								<Skeleton className="h-4 w-[94%]" />
								<Skeleton className="h-4 w-[88%]" />
								<Skeleton className="h-4 w-[60%]" />
							</div>

							<div className="space-y-3 pt-4">
								<Skeleton className="h-4 w-[98%]" />
								<Skeleton className="h-4 w-[92%]" />
								<Skeleton className="h-4 w-[80%]" />
							</div>
						</div>
					</div>
				</div>

				{/* Inspector Side Panel skeleton (visible on wide screens) */}
				<aside className="hidden w-80 shrink-0 flex-col border-l bg-monti-background lg:flex">
					{/* Inspector Header / Tabs */}
					<div className="flex h-12 shrink-0 items-center justify-between border-b px-4">
						<div className="flex items-center gap-2">
							<Skeleton className="h-7 w-14 rounded-md" />
							<Skeleton className="h-7 w-14 rounded-md" />
						</div>
						<Skeleton className="size-6 rounded-md" />
					</div>

					{/* Inspector Fields */}
					<div className="flex-1 space-y-5 overflow-y-auto p-4">
						{/* Address Field */}
						<div className="space-y-1.5">
							<Skeleton className="h-3.5 w-16" />
							<Skeleton className="h-9 w-full rounded-md" />
						</div>

						{/* Summary Field */}
						<div className="space-y-1.5">
							<Skeleton className="h-3.5 w-20" />
							<Skeleton className="h-16 w-full rounded-md" />
						</div>

						{/* Classification Section */}
						<div className="space-y-3 pt-2">
							<Skeleton className="h-3 w-24" />
							<div className="space-y-1.5">
								<Skeleton className="h-3.5 w-16" />
								<Skeleton className="h-9 w-full rounded-md" />
							</div>
							<div className="space-y-1.5">
								<Skeleton className="h-3.5 w-12" />
								<Skeleton className="h-9 w-full rounded-md" />
							</div>
						</div>

						{/* Work log / Policy Section */}
						<div className="space-y-3 pt-2">
							<Skeleton className="h-3 w-20" />
							<div className="space-y-1.5">
								<Skeleton className="h-3.5 w-14" />
								<Skeleton className="h-9 w-full rounded-md" />
							</div>
						</div>
					</div>
				</aside>
			</div>
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
