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
 * The Data page (`<admin path>/data`, under Tools in the sidebar): what is kept in the site rather than in its schema file. Site backup and Import entries
 * are sections like the settings pages; Restore backup is last, a danger section, because it writes the whole site in one step and cannot be undone.
 */
export function DataScreen() {
	const t = useTranslator(dataMessages);
	const te = useTranslator(exportMessages);
	const ti = useTranslator(importMessages);
	const tr = useTranslator(restoreMessages);
	const form = useExportForm();
	return (
		<ShellPage title={t("title")} nav="data" large>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<PageBody data-testid="data-screen" className="gap-section">
					<Section wide band title={te("data.title")} testId="site-backup">
						<ExportFields form={form} />
						<ExportProgressLine phase={form.phase} />
						<div>
							<ExportButton form={form} label={te("action.all")} />
						</div>
					</Section>
					<Section
						wide
						band
						title={ti("title")}
						description={ti("description")}
						testId="import-entries"
						id="import-entries"
					>
						<ImportEntriesFields />
					</Section>
					<Section
						wide
						band
						danger
						title={tr("danger.title")}
						description={tr("danger.description")}
						testId="restore-backup"
					>
						<RestoreBackupFields />
					</Section>
				</PageBody>
			</div>
		</ShellPage>
	);
}
