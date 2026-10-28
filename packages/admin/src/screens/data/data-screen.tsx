"use client";

import { useTranslator } from "@monti-cms/core/site";
import { Box, Stack } from "@monti-cms/ui";
import { ExportButton, ExportFields, ExportProgressLine } from "../export/export-fields";
import { exportMessages } from "../export/messages";
import { useExportForm } from "../export/use-export-form";
import { importMessages } from "../import/messages";
import { Section } from "../shared/section";
import { ToolsFrame } from "../tools/tools-frame";
import { ZipImport } from "./zip-import";

/**
 * The Data page (`<admin path>/data`, under Tools in the sidebar): what is kept in the site rather than in its schema file. Site backup and Import
 * entries are sections like the settings pages. Import is one button that takes a zip: a full backup on an empty site opens the restore sheet, any other
 * zip opens the import sheet.
 */
export function DataScreen() {
	const te = useTranslator(exportMessages);
	const ti = useTranslator(importMessages);
	const form = useExportForm();
	return (
		<ToolsFrame tab="data">
			<Stack gap={48} data-testid="data-screen">
				<Section wide band rows={false} title={te("data.title")} testId="site-backup">
					<ExportFields form={form} />
					<ExportProgressLine phase={form.phase} />
					<Box>
						<ExportButton form={form} label={te("action.all")} />
					</Box>
				</Section>
				<Section wide band rows={false} title={ti("title")} testId="import-entries" id="import-entries">
					<ZipImport />
				</Section>
			</Stack>
		</ToolsFrame>
	);
}
