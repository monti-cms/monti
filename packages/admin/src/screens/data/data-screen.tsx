"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Box, Stack } from "@monti-cms/ui";
import { ExportButton, ExportFields, ExportProgressLine } from "../export/export-fields";
import { exportMessages } from "../export/messages";
import { useExportForm } from "../export/use-export-form";
import { ImportEntriesFields } from "../import/import-entries-card";
import { importMessages } from "../import/messages";
import { restoreMessages } from "../restore/messages";
import { RestoreBackupFields } from "../restore/restore-card";
import { Section } from "../shared/section";
import { ToolsFrame } from "../tools/tools-frame";

/**
 * The Data page (`<admin path>/data`, under Tools in the sidebar): what is kept in the site rather than in its schema file. Site backup and Import entries
 * are sections like the settings pages; Restore backup is last, a danger section, because it writes the whole site in one step and cannot be undone.
 */
export function DataScreen() {
	const te = useTranslator(exportMessages);
	const ti = useTranslator(importMessages);
	const tr = useTranslator(restoreMessages);
	const form = useExportForm();
	return (
		<ToolsFrame tab="data">
			<Stack gap={48} data-testid="data-screen">
				<Stack gap={48}>
					<Section wide band rows={false} title={te("data.title")} testId="site-backup">
						<ExportFields form={form} />
						<ExportProgressLine phase={form.phase} />
						<Box>
							<ExportButton form={form} label={te("action.all")} />
						</Box>
					</Section>
					<Section
						wide
						band
						rows={false}
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
				</Stack>
			</Stack>
		</ToolsFrame>
	);
}
