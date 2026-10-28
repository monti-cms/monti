"use client";

import { useSite, useTranslator } from "@monti-cms/core/site";
import {
	Banner,
	Box,
	Button,
	Sheet,
	SheetBody,
	SheetContent,
	SheetFooter,
	SheetHeader,
	SheetTitle,
	Text,
	TextButton,
} from "@monti-cms/ui";
import { errorText } from "../../api/client";
import type { ImportPreview } from "../../api/import";
import { commonMessages } from "../../lib/common.messages";
import { PreviewView } from "./import-preview";
import { ResultView } from "./import-result";
import { importMessages } from "./messages";
import type { ImportForm } from "./use-import-entries";

/**
 * The import of a zip, in a sheet: what the archive holds and where each collection goes, then Import. The result replaces that in the same sheet and
 * the pill leads to the list. The sheet cannot be left while it writes. `file` is the zip's name, after the title; `onClose` forgets the file.
 */
export function ImportSheet({
	file,
	preview,
	form,
	onClose,
}: {
	file: string;
	preview: ImportPreview;
	form: ImportForm;
	onClose: () => void;
}) {
	const t = useTranslator(importMessages);
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
					{result ? (
						<ResultView result={result} />
					) : (
						<>
							<Box dimmed={form.previewQuery.isPlaceholderData} aria-busy={form.previewQuery.isPlaceholderData}>
								<PreviewView preview={preview} form={form} />
							</Box>
							{preview.counts.imported === 0 && (
								<Text as="p" variant="caption" tone="muted">
									{t("nothing.description")}
								</Text>
							)}
						</>
					)}
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
							<Button
								type="button"
								loading={running}
								disabled={form.previewQuery.isPlaceholderData || preview.counts.imported === 0}
								onClick={form.start}
							>
								{running ? t("action.importing") : t("action.import", { count: preview.counts.imported })}
							</Button>
						</>
					)}
				</SheetFooter>
			</SheetContent>
		</Sheet>
	);
}
