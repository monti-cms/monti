"use client";

import { useState } from "react";
import { useImportEntries } from "../import/use-import-entries";
import { useImportLimit } from "../import/use-import-limit";
import { useRestoreBackup } from "../restore/use-restore-backup";
import { readsImport, type ZipReading, zipPhase } from "./zip-phase";

/**
 * The zip chosen on the Data page: it is read at once, then it opens the restore sheet (a full backup on an empty site) or the import sheet (any other
 * zip). Nothing is written until the pill of a sheet. `close` forgets the file; the page calls it when a sheet closes.
 */
export function useDataZip() {
	// Counts the files chosen, so reading the same file again after it was closed is a new read.
	const [pick, setPick] = useState<{ file: File; number: number } | null>(null);
	const [count, setCount] = useState(0);
	const file = pick?.file ?? null;
	const number = pick?.number ?? 0;

	const { limit, tooLarge } = useImportLimit(file);
	const restore = useRestoreBackup(file, number, file !== null && !tooLarge);

	const reading: ZipReading = {
		hasFile: file !== null,
		tooLarge,
		stateReady: restore.stateReady,
		empty: restore.empty,
		restoreSettled: restore.previewSettled,
		isBackup: restore.preview?.isBackup === true,
		restored: restore.result !== undefined,
		importRead: false,
		importFailed: false,
	};
	const imports = useImportEntries(file, number, readsImport(reading));
	const phase = zipPhase({
		...reading,
		importRead: imports.preview !== undefined,
		importFailed: imports.previewQuery.isError && imports.preview === undefined,
	});

	return {
		file,
		phase,
		limit,
		restore,
		imports,
		/** A sheet is writing: it cannot be left until it is done. */
		busy: imports.isRunning || restore.isRunning,
		choose: (next: File) => {
			imports.reset();
			restore.reset();
			setCount(count + 1);
			setPick({ file: next, number: count + 1 });
		},
		close: () => {
			imports.reset();
			restore.reset();
			setPick(null);
		},
	};
}

export type DataZip = ReturnType<typeof useDataZip>;
