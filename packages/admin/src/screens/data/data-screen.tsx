"use client";

import { useTranslator } from "@monti-cms/core/site";
import { ExportButton, ExportFields, ExportProgressLine } from "../export/export-fields";
import { exportMessages } from "../export/messages";
import { useExportForm } from "../export/use-export-form";
import { ImportEntriesFields } from "../import/import-entries-card";
import { importMessages } from "../import/messages";
import { restoreMessages } from "../restore/messages";
import { RestoreBackupFields } from "../restore/restore-card";
import { ShellPage } from "../shared/admin-shell";
import { PageBody } from "../shared/page-body";
import { Section } from "../shared/section";
import { dataMessages } from "./messages";

/**
 * The Data page (`<admin path>/data`, under Tools in the sidebar): what is kept in the site rather than in its schema file. It holds the Site backup card, below it
 * the Import entries card, and last the Restore backup card.
 */
export function DataScreen() {
	const t = useTranslator(dataMessages);
	const te = useTranslator(exportMessages);
	const ti = useTranslator(importMessages);
	const tr = useTranslator(restoreMessages);
	const form = useExportForm();
	return (
		<ShellPage title={t("title")} nav="data">
			<PageBody data-testid="data-screen">
				<Section wide title={te("data.title")} description={te("data.description")} testId="site-backup">
					<ExportFields form={form} />
					<ExportProgressLine phase={form.phase} />
					<div>
						<ExportButton form={form} label={te("action.all")} />
					</div>
				</Section>
				<Section wide title={ti("title")} description={ti("description")} testId="import-entries">
					<ImportEntriesFields />
				</Section>
				<Section wide title={tr("title")} description={tr("description")} testId="restore-backup">
					<RestoreBackupFields />
				</Section>
			</PageBody>
		</ShellPage>
	);
}
