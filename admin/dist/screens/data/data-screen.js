"use client";
import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/site";
import { ExportButton, ExportFields, ExportProgressLine } from "../export/export-fields.js";
import { exportMessages } from "../export/messages.js";
import { useExportForm } from "../export/use-export-form.js";
import { ImportEntriesFields } from "../import/import-entries-card.js";
import { importMessages } from "../import/messages.js";
import { restoreMessages } from "../restore/messages.js";
import { RestoreBackupFields } from "../restore/restore-card.js";
import { ShellPage } from "../shared/admin-shell.js";
import { PageBody } from "../shared/page-body.js";
import { Section } from "../shared/section.js";
import { dataMessages } from "./messages.js";
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
    return (_jsx(ShellPage, { title: t("title"), nav: "data", children: _jsxs(PageBody, { "data-testid": "data-screen", children: [_jsxs(Section, { wide: true, title: te("data.title"), description: te("data.description"), testId: "site-backup", children: [_jsx(ExportFields, { form: form }), _jsx(ExportProgressLine, { phase: form.phase }), _jsx("div", { children: _jsx(ExportButton, { form: form, label: te("action.all") }) })] }), _jsx(Section, { wide: true, title: ti("title"), description: ti("description"), testId: "import-entries", children: _jsx(ImportEntriesFields, {}) }), _jsx(Section, { wide: true, title: tr("title"), description: tr("description"), testId: "restore-backup", children: _jsx(RestoreBackupFields, {}) })] }) }));
}
