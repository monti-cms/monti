"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Banner,
	Box,
	Button,
	Heading,
	List,
	ListItem,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Stack,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { errorText } from "../../api/client";
import type { RestoreCounts, RestoreNotRestored, RestorePreview, RestoreWarning } from "../../api/restore";
import { commonMessages } from "../../lib/common.messages";
import { restoreMessages } from "./messages";
import type { RestoreForm } from "./use-restore-backup";

/** The most problems, warnings and skipped templates listed; the counts above them cover all. */
const LIST_LIMIT = 50;
const STATUSES = ["draft", "published", "archived", "trashed"] as const;

/** What a restore holds, in plain lines. */
function CountLines({ counts }: { counts: RestoreCounts }) {
	const t = useTranslator(restoreMessages);
	const statuses = STATUSES.filter((status) => (counts.byStatus[status] ?? 0) > 0).map((status) =>
		t(`summary.${status}`, { count: counts.byStatus[status] ?? 0 }),
	);
	return (
		<Stack gap={8}>
			<Text as="p" variant="title">
				{t("summary.entries", { count: counts.entries })}
			</Text>
			<List>
				{statuses.length > 0 && (
					<ListItem>
						<Text tone="muted">{statuses.join(" · ")}</Text>
					</ListItem>
				)}
				{counts.translations > 0 && (
					<ListItem>
						<Text tone="muted">{t("summary.translations", { count: counts.translations })}</Text>
					</ListItem>
				)}
				<ListItem>
					<Text tone="muted">{t("summary.folders", { count: counts.folders })}</Text>
				</ListItem>
				<ListItem>
					<Text tone="muted">{t("summary.media", { count: counts.media })}</Text>
				</ListItem>
				<ListItem>
					<Text tone="muted">{t("summary.addresses", { count: counts.addresses, aliases: counts.aliases })}</Text>
				</ListItem>
				<ListItem>
					<Text tone="muted">
						{t("summary.templates", { added: counts.templatesAdded, skipped: counts.templatesSkipped.length })}
					</Text>
				</ListItem>
			</List>
			{counts.templatesSkipped.length > 0 && (
				<Stack gap={4} paddingTop={4}>
					<Text as="p" weight="medium">
						{t("templates.title")}
					</Text>
					<Stack as="ul" gap={2}>
						{counts.templatesSkipped.slice(0, LIST_LIMIT).map((template) => (
							<Text as="li" variant="caption" tone="muted" key={template.id}>
								<Text weight="medium">{template.name}</Text>: {template.text}
							</Text>
						))}
					</Stack>
				</Stack>
			)}
		</Stack>
	);
}

/** Every problem that stops the restore, with what it is about and what the check found. */
function Problems({ preview }: { preview: RestorePreview }) {
	const t = useTranslator(restoreMessages);
	const shown = preview.problems.slice(0, LIST_LIMIT);
	return (
		<Stack as="section" gap={8} aria-label={t("problems.title")}>
			<Heading as="h4" variant="label" tone="danger">
				{t("problems.title")}
			</Heading>
			<Text as="p" variant="caption" tone="muted">
				{t("problems.hint")}
			</Text>
			<Box radius="md" border="all" paddingX={12} paddingY={8} maxHeight="list" overflow="y">
				<Stack as="ul" gap={8}>
					{shown.map((problem, index) => (
						<Stack
							as="li"
							// biome-ignore lint/suspicious/noArrayIndexKey: a problem has no id of its own; the list does not change while it is shown.
							key={index}
							gap={2}
							paddingBottom={8}
							border="bottom"
						>
							<Text weight="medium">{problem.label ?? problem.id ?? t("problems.archive")}</Text>
							<Text variant="caption" tone="muted">
								{problem.text}
							</Text>
							{problem.found.map((line) => (
								<Text key={line} variant="caption" tone="muted">
									{line}
								</Text>
							))}
						</Stack>
					))}
				</Stack>
			</Box>
			{preview.problems.length > LIST_LIMIT && (
				<Text as="p" variant="caption" tone="muted">
					{t("problems.more", { count: preview.problems.length - LIST_LIMIT })}
				</Text>
			)}
		</Stack>
	);
}

function Warnings({ warnings }: { warnings: RestoreWarning[] }) {
	const t = useTranslator(restoreMessages);
	if (warnings.length === 0) return null;
	return (
		<Stack as="section" gap={8} aria-label={t("warnings.title")}>
			<Heading as="h4" variant="label">
				{t("warnings.title")}
			</Heading>
			<Stack as="ul" gap={4}>
				{warnings.slice(0, LIST_LIMIT).map((warning) => (
					<Text as="li" variant="caption" tone="muted" key={`${warning.code}:${warning.id ?? ""}`}>
						{warning.label && <Text weight="medium">{warning.label} </Text>}
						{warning.text}
					</Text>
				))}
			</Stack>
			{warnings.length > LIST_LIMIT && (
				<Text as="p" variant="caption" tone="muted">
					{t("warnings.more", { count: warnings.length - LIST_LIMIT })}
				</Text>
			)}
		</Stack>
	);
}

function NotRestored({ items }: { items: RestoreNotRestored[] }) {
	const t = useTranslator(restoreMessages);
	return (
		<Stack as="section" gap={8} aria-label={t("notRestored.title")}>
			<Heading as="h4" variant="label">
				{t("notRestored.title")}
			</Heading>
			<Text as="p" variant="caption" tone="muted">
				{t("notRestored.hint")}
			</Text>
			<List>
				{items.map((item) => (
					<ListItem key={item.code}>
						<Text variant="caption" tone="muted">
							{item.text}
						</Text>
					</ListItem>
				))}
			</List>
		</Stack>
	);
}

/** What restoring the backup would do: the counts, the problems that stop it, the warnings, and what a restore leaves as it is. */
function PreviewView({ preview }: { preview: RestorePreview }) {
	return (
		<Stack gap={24}>
			<CountLines counts={preview.counts} />
			{preview.problems.length > 0 && <Problems preview={preview} />}
			<Warnings warnings={preview.warnings} />
			<NotRestored items={preview.notRestored} />
		</Stack>
	);
}

function ResultView({ result }: { result: NonNullable<RestoreForm["result"]> }) {
	const t = useTranslator(restoreMessages);
	return (
		<Stack gap={24}>
			<Stack gap={8}>
				<Heading as="h4">{t("result.title")}</Heading>
				<Text as="p" tone="muted">
					{t("result.summary", { count: result.counts.entries })}
				</Text>
			</Stack>
			<CountLines counts={result.counts} />
			<Warnings warnings={result.warnings} />
			<NotRestored items={result.notRestored} />
		</Stack>
	);
}

/**
 * Putting a full backup back into an empty site as it was, in a sheet: what restoring it would do (counts, problems, warnings, what is not restored),
 * then Restore. A restore is all or nothing, so while a problem is left the pill is off. The result replaces that in the same sheet and the pill leads to
 * the list. The sheet cannot be left while it writes. `file` is the backup's name, after the title; `onClose` forgets the file.
 */
export function RestoreSheet({
	file,
	preview,
	form,
	onClose,
}: {
	file: string;
	preview: RestorePreview | undefined;
	form: RestoreForm;
	onClose: () => void;
}) {
	const t = useTranslator(restoreMessages);
	const tc = useTranslator(commonMessages);
	const site = useSite();
	const { result } = form;
	const running = form.isRunning;
	return (
		<Sheet open onOpenChange={(open) => !(open || running) && onClose()}>
			<SheetContent>
				<SheetHeader closable={!running}>
					<SheetTitle of={file}>{t("title")}</SheetTitle>
				</SheetHeader>
				<SheetBody>
					{result ? <ResultView result={result} /> : preview && <PreviewView preview={preview} />}
					{Boolean(form.runError) && (
						<Banner role="alert" tone="danger" title={errorText(site, form.runError, t("error.run"))} />
					)}
				</SheetBody>
				<SheetFooter>
					{result ? (
						// biome-ignore lint/a11y/useAnchorContent: the Button renders its children into this link
						<Button nativeButton={false} role="link" render={<a href={site.adminHref()} />}>
							{t("action.view")}
						</Button>
					) : (
						<>
							<TextButton type="button" disabled={running} onClick={onClose}>
								{tc("cancel")}
							</TextButton>
							<Button type="button" loading={running} disabled={!preview?.ready} onClick={form.start}>
								{running ? t("action.restoring") : t("action.restore")}
							</Button>
						</>
					)}
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
