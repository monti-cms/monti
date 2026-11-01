"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Box, Stack, Text, TextButton } from "@monti-cms/ui";
import { commonMessages } from "../lib/common.messages";
import type { TranslatorFor } from "../translator";
import { type LinkTarget, useLinkTarget } from "./link-targets";
import { editorMessages } from "./messages";

const nameOf = (tc: TranslatorFor<typeof commonMessages>, target: LinkTarget) => target.title || tc("untitled");

/**
 * What the link bubble says of the entry: its name, the line under it, and the label of the link, which names where it opens. An entry that is not
 * published says so after its address, and opens in the admin.
 */
export function linkTargetText(
	t: TranslatorFor<typeof editorMessages>,
	tc: TranslatorFor<typeof commonMessages>,
	target: LinkTarget,
): { name: string; address: string; label: string } {
	const name = nameOf(tc, target);
	return {
		name,
		address: `${target.path ?? ""}${target.published ? "" : `${target.path ? " · " : ""}${t("link.targetDraft")}`}`,
		label: target.published ? t("link.targetOpenSite", { title: name }) : t("link.targetOpenAdmin", { title: name }),
	};
}

/**
 * Where an internal link goes, shown in the link bubble: the title and the address of the entry, which opens the entry (its page on the site when it is
 * published, otherwise the entry in the admin). The document holds only the id of the entry, so the entry is looked up (`useLinkTarget`).
 */
export function LinkTargetAnchor({ entryId }: { entryId: string }) {
	const t = useTranslator(editorMessages);
	const tc = useTranslator(commonMessages);
	const state = useLinkTarget(entryId);
	if (!state || state.status === "loading") {
		return (
			<Box as="span" paddingX={4}>
				<Text variant="caption" tone="muted">
					{t("link.targetLoading")}
				</Text>
			</Box>
		);
	}
	if (state.status === "missing") {
		return (
			<Box as="span" paddingX={4}>
				<Text variant="caption" tone="danger">
					{t("link.targetMissing")}
				</Text>
			</Box>
		);
	}
	if (state.status === "error") {
		return (
			<Box as="span" paddingX={4}>
				<Text variant="caption" tone="muted">
					{t("link.targetUnavailable")}
				</Text>
			</Box>
		);
	}
	const { target } = state;
	const { name, address, label } = linkTargetText(t, tc, target);
	return (
		<Box as="span" paddingX={4} minWidth={0} maxWidth="menu">
			<TextButton
				variant="underline"
				href={target.href}
				target="_blank"
				rel="noreferrer noopener"
				title={label}
				aria-label={label}
				// If focus is taken from the editor on press, the bubble disappears first and the link does not open.
				onMouseDown={(event) => event.preventDefault()}
			>
				<Stack as="span" gap={0}>
					<Text variant="caption" tone="default" truncate>
						{name}
					</Text>
					<Text variant="caption" tone="muted" truncate>
						{address}
					</Text>
				</Stack>
			</TextButton>
		</Box>
	);
}

/** A line in the link form saying where the link goes now. */
export function LinkTargetSummary({ entryId }: { entryId: string }) {
	const t = useTranslator(editorMessages);
	const tc = useTranslator(commonMessages);
	const state = useLinkTarget(entryId);
	let text: string;
	if (!state || state.status === "loading") text = t("link.targetLoading");
	else if (state.status === "missing") text = t("link.targetMissing");
	else if (state.status === "error") text = t("link.targetUnavailable");
	else text = t("link.target", { title: nameOf(tc, state.target) });
	const path = state?.status === "ready" ? state.target.path : null;
	return (
		<Stack gap={2}>
			<Text as="p" variant="caption" tone={state?.status === "missing" ? "danger" : "default"}>
				{text}
			</Text>
			{path && (
				<Text as="p" variant="caption" tone="muted">
					{path}
				</Text>
			)}
			<Text as="p" variant="caption" tone="muted">
				{t("link.replaceHint")}
			</Text>
		</Stack>
	);
}
