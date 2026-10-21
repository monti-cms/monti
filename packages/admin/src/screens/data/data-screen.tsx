"use client";

import { useTranslator } from "@monti-cms/core/site";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils/cn";
import { ExportButton, ExportFields, ExportProgressLine } from "../export/export-fields";
import { exportMessages } from "../export/messages";
import { useExportForm } from "../export/use-export-form";
import { ImportEntriesFields } from "../import/import-entries-card";
import { importMessages } from "../import/messages";
import { restoreMessages } from "../restore/messages";
import { RestoreBackupFields } from "../restore/restore-card";
import { ShellPage } from "../shared/admin-shell";
import { PageBody } from "../shared/page-body";
import { dataMessages } from "./messages";

/** One band of the page: the title and its line on top, the content under them, a hairline above every band but the first. */
function Band({
	title,
	description,
	danger,
	id,
	testId,
	children,
}: {
	title: ReactNode;
	description: ReactNode;
	danger?: boolean;
	id?: string;
	testId: string;
	children: ReactNode;
}) {
	return (
		<section
			id={id}
			data-testid={testId}
			aria-labelledby={`${testId}-title`}
			className={cn(
				"flex scroll-mt-6 flex-col gap-5",
				danger ? "rounded-lg border border-monti-destructive/40 p-5" : "not-first:border-t not-first:pt-8",
			)}
		>
			<div>
				<h2
					id={`${testId}-title`}
					className={cn("font-semibold text-monti-title", danger && "text-monti-destructive-foreground")}
				>
					{title}
				</h2>
				<p className="mt-1 max-w-prose text-monti-body text-monti-muted-foreground leading-relaxed">{description}</p>
			</div>
			{children}
		</section>
	);
}

/**
 * The Data page (`<admin path>/data`, under Tools in the sidebar): what is kept in the site rather than in its schema file. Site backup and Import entries
 * are bands one under the other; Restore backup is last, inside a danger zone, because it writes the whole site in one step and cannot be undone.
 */
export function DataScreen() {
	const t = useTranslator(dataMessages);
	const te = useTranslator(exportMessages);
	const ti = useTranslator(importMessages);
	const tr = useTranslator(restoreMessages);
	const form = useExportForm();
	return (
		<ShellPage title={t("title")} description={t("description")} nav="data" large>
			<div className="min-h-0 flex-1 overflow-y-auto">
				<PageBody data-testid="data-screen" className="gap-8">
					<Band title={te("data.title")} description={te("data.description")} testId="site-backup">
						<ExportFields form={form} />
						<ExportProgressLine phase={form.phase} />
						<div>
							<ExportButton form={form} label={te("action.all")} />
						</div>
					</Band>
					<Band title={ti("title")} description={ti("description")} testId="import-entries" id="import-entries">
						<ImportEntriesFields />
					</Band>
					<Band title={tr("danger.title")} description={tr("danger.description")} danger testId="restore-backup">
						<RestoreBackupFields />
					</Band>
				</PageBody>
			</div>
		</ShellPage>
	);
}
