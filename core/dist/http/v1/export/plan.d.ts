import type { z } from "zod";
import type { Cms } from "../../../cms/index.js";
import type { exportOptionsSchema } from "../../../core/api.js";
import { type ExportPlan, type ExportScope, type ExportTexts } from "../../../services/export-service.js";
export type ExportOptions = z.output<typeof exportOptionsSchema>;
/** What an export holds, read from the store: the whole site, or the selection with its translation groups. */
export declare function readExportPlan(cms: Cms, options: Pick<ExportOptions, "scope" | "ids">): Promise<ExportPlan>;
/** Fails with `unknown_format` before any work is done if no installed format has that name. */
export declare function assertFormatInstalled(cms: Cms, format: string): Promise<void>;
/**
 * Writes the bodies of an export as text in a format. The admin archive is a backup, so its texts are written to be imported again (`sync`: links by path,
 * an unresolved link keeps its id, media by id) and resolve links to the current address of any entry. The public archive is for readers: only published
 * entries, links as readers see them (an unpublished target is not a link), images by public URL.
 *
 * A body the format cannot write is not an error of the export: its JSON document stays in the archive, its text file is skipped and it is listed in
 * `notWritten`. Only a format nobody provides fails the export.
 */
export declare function exportTexts(cms: Cms, plan: ExportPlan, scope: ExportScope, format: string): Promise<ExportTexts>;
