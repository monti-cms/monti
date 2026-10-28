/** Where a zip chosen on the Data page is: what the page says about it, and which sheet (if any) is open. */
export type ZipPhase = "idle" | "too-large" | "reading" | "failed" | "restore" | "import";

export interface ZipReading {
	/** A zip is chosen. */
	hasFile: boolean;
	tooLarge: boolean;
	/** Whether the site is empty has been read. */
	stateReady: boolean;
	/** The site has no entries, folders or media, so a backup can be restored into it. */
	empty: boolean;
	/** The restore check of the file is in, or failed. Only read on an empty site. */
	restoreSettled: boolean;
	/** The file is a full backup, as the restore check says. */
	isBackup: boolean;
	/** A restore of this file has run; its result stays in the sheet whatever the site looks like now. */
	restored: boolean;
	/** The import preview is in. */
	importRead: boolean;
	importFailed: boolean;
}

/**
 * What to do with a chosen zip. A full backup on an empty site is restored as it was; any other zip is imported as new entries; a site that has
 * entries never reads a zip as a backup. The page says "reading" until the sheet can show something, and "failed" when nothing can be shown.
 */
export function zipPhase(reading: ZipReading): ZipPhase {
	if (!reading.hasFile) return "idle";
	if (reading.restored) return "restore";
	if (reading.tooLarge) return "too-large";
	if (!reading.stateReady) return "reading";
	if (reading.empty) {
		if (!reading.restoreSettled) return "reading";
		if (reading.isBackup) return "restore";
	}
	if (reading.importRead) return "import";
	return reading.importFailed ? "failed" : "reading";
}

/** Whether the import preview should be read now: the file is readable, the check for a backup is done, and it was not one. */
export function readsImport(reading: ZipReading): boolean {
	if (!reading.hasFile || reading.tooLarge || reading.restored || !reading.stateReady) return false;
	if (!reading.empty) return true;
	return reading.restoreSettled && !reading.isBackup;
}
