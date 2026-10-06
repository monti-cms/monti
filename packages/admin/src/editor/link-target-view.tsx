"use client";

import { createTranslator } from "@monti-cms/core/client";
import { cn } from "../lib/utils/cn";
import { type LinkTarget, useLinkTarget } from "./link-targets";
import { editorMessages } from "./messages";

const t = createTranslator(editorMessages);

const nameOf = (target: LinkTarget) => target.title || t("toolbar.untitled");

/**
 * Where an internal link goes, shown in the link bubble: the title and the address of the entry, which opens the entry (its page on the site when it is
 * published, otherwise the entry in the admin). The document holds only the id of the entry, so the entry is looked up (`useLinkTarget`).
 */
export function LinkTargetAnchor({ entryId, className }: { entryId: string; className?: string }) {
	const state = useLinkTarget(entryId);
	if (!state || state.status === "loading") {
		return <span className={cn("px-1 text-cms-muted-foreground text-xs", className)}>{t("link.targetLoading")}</span>;
	}
	if (state.status === "missing") {
		return <span className={cn("px-1 text-cms-destructive text-xs", className)}>{t("link.targetMissing")}</span>;
	}
	if (state.status === "error") {
		return (
			<span className={cn("px-1 text-cms-muted-foreground text-xs", className)}>{t("link.targetUnavailable")}</span>
		);
	}
	const { target } = state;
	const label = target.published
		? t("link.targetOpenSite", { title: nameOf(target) })
		: t("link.targetOpenAdmin", { title: nameOf(target) });
	return (
		<a
			href={target.href}
			target="_blank"
			rel="noreferrer noopener"
			title={label}
			aria-label={label}
			// If focus is taken from the editor on press, the bubble disappears first and the link does not open.
			onMouseDown={(event) => event.preventDefault()}
			className={cn("flex min-w-0 max-w-64 flex-col px-1 text-xs", className)}
		>
			<span className="truncate text-cms-primary underline underline-offset-2">{nameOf(target)}</span>
			<span className="truncate text-cms-muted-foreground">
				{target.path ?? ""}
				{target.published ? "" : `${target.path ? " · " : ""}${t("link.targetDraft")}`}
			</span>
		</a>
	);
}

/** A line in the link form saying where the link goes now. */
export function LinkTargetSummary({ entryId }: { entryId: string }) {
	const state = useLinkTarget(entryId);
	let text: string;
	if (!state || state.status === "loading") text = t("link.targetLoading");
	else if (state.status === "missing") text = t("link.targetMissing");
	else if (state.status === "error") text = t("link.targetUnavailable");
	else text = t("link.target", { title: nameOf(state.target) });
	const path = state?.status === "ready" ? state.target.path : null;
	return (
		<div className="grid gap-0.5 text-xs">
			<p className={cn(state?.status === "missing" && "text-cms-destructive")}>{text}</p>
			{path && <p className="text-cms-muted-foreground">{path}</p>}
			<p className="text-cms-muted-foreground">{t("link.replaceHint")}</p>
		</div>
	);
}
