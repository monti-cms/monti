"use client";

// The loading and load-error states of the entry editor screen.

import { useSite, useTranslator } from "@monti-cms/core/site";
import { Box, Button, Inline, Skeleton, Stack, Text } from "@monti-cms/ui";
import { AdminLink as Link } from "../../router";
import { LoadErrorAlert } from "../shared/load-error-alert";
import { entryEditorShellMessages } from "./entry-editor-shell.messages";

export function EntryEditorLoading() {
	const t = useTranslator(entryEditorShellMessages);
	return (
		<Stack gap="none" height="screen" overflow="clip" background="page" aria-busy="true">
			<Text srOnly>{t("loadingDocument")}</Text>

			{/* Top header skeleton */}
			<Inline as="header" justify="between" height="control" shrink={false} border="bottom" paddingX="comfortable">
				<Inline gap="condensed">
					<Skeleton shape="icon" />
					<Skeleton shape="line" width="quarter" />
				</Inline>
				<Inline gap="condensed">
					<Skeleton shape="line" width="quarter" />
					<Skeleton shape="control-sm" width="quarter" />
					<Skeleton shape="icon" />
					<Skeleton shape="icon" />
				</Inline>
			</Inline>

			{/* Editor canvas and inspector side panel */}
			<Inline align="stretch" gap="none" grow minHeight={0} overflow="hidden" position="relative">
				<Stack gap="none" grow minWidth={0} height="full" overflow="hidden">
					{/* Formatting toolbar skeleton */}
					<Inline
						gap="condensed"
						justify="center"
						shrink={false}
						border="bottom"
						paddingX="spacious"
						paddingY="condensed"
					>
						<Skeleton shape="control-sm" width="quarter" />
						<Skeleton shape="icon" />
						<Skeleton shape="icon" />
						<Skeleton shape="icon" />
						<Skeleton shape="icon" />
					</Inline>

					{/* Document canvas */}
					<Box grow minHeight={0} overflow="y" paddingX="spacious" paddingY="wide">
						<Stack gap="spacious" maxWidth="prose">
							{/* Language tabs skeleton */}
							<Inline gap="condensed">
								<Skeleton shape="control-sm" width="quarter" />
								<Skeleton shape="control-sm" width="quarter" />
							</Inline>

							{/* Title skeleton */}
							<Skeleton shape="title" width="half" />

							{/* Paragraph skeletons */}
							<Stack gap="normal">
								<Skeleton shape="line" />
								<Skeleton shape="line" />
								<Skeleton shape="line" width="half" />
							</Stack>
							<Stack gap="normal">
								<Skeleton shape="line" />
								<Skeleton shape="line" width="third" />
							</Stack>
						</Stack>
					</Box>
				</Stack>

				{/* Inspector side panel skeleton (visible on wide screens) */}
				<Stack as="aside" gap="none" hideBelow="lg" width="panel-sm" shrink={false} border="left" background="page">
					<Inline justify="between" height="control" shrink={false} border="bottom" paddingX="comfortable">
						<Inline gap="condensed">
							<Skeleton shape="control-sm" width="quarter" />
							<Skeleton shape="control-sm" width="quarter" />
						</Inline>
						<Skeleton shape="icon" />
					</Inline>

					{/* Inspector fields */}
					<Stack gap="comfortable" grow overflow="y" padding="comfortable">
						<Stack gap="condensed">
							<Skeleton shape="line" width="quarter" />
							<Skeleton shape="control" />
						</Stack>
						<Stack gap="condensed">
							<Skeleton shape="line" width="quarter" />
							<Skeleton shape="block" />
						</Stack>
						<Stack gap="condensed">
							<Skeleton shape="line" width="quarter" />
							<Skeleton shape="control" />
						</Stack>
						<Stack gap="condensed">
							<Skeleton shape="line" width="quarter" />
							<Skeleton shape="control" />
						</Stack>
					</Stack>
				</Stack>
			</Inline>
		</Stack>
	);
}

export function EntryEditorLoadError({ message }: { message: string }) {
	const site = useSite();
	const t = useTranslator(entryEditorShellMessages);
	return (
		<Stack gap="normal" padding="wide">
			{/* The shared notice: a grid Alert without an icon put the text in the 16px icon column, one letter per line. */}
			<LoadErrorAlert message={message} />
			<Box>
				<Button variant="outline" nativeButton={false} render={<Link role="link" href={site.adminHref()} />}>
					{t("backToList")}
				</Button>
			</Box>
		</Stack>
	);
}
