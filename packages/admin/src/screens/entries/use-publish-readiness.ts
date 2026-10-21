"use client";

// The publish readiness of the entry being edited: what the server's publish check finds in the saved draft, kept up to date as the draft is saved.

import { useSite } from "@monti-cms/core/site";
import { useCallback, useEffect, useRef, useState } from "react";
import { checkEntryPublish } from "../../api/entries";
import type { CmsIssue } from "../../api/error-message";
import type { PublishCheckResult } from "../shared/publish-readiness";

export interface PublishReadiness {
	/** What the latest check found. `null` before the first answer, and after a check that could not be made (the item then stays hidden). */
	readonly result: PublishCheckResult | null;
	/** Whether a check is running. */
	readonly checking: boolean;
	/** Checks the saved draft again. */
	readonly recheck: () => void;
	/** Shows the problems a publish was refused with as the result, since they are the freshest. */
	readonly setBlocked: (issues: readonly CmsIssue[]) => void;
}

/**
 * Runs the check when `enabled` turns on and whenever `version` moves (the entry loaded, then every save that changed it), never on a keystroke.
 * `enabled` is off for an entry that cannot be published (trashed, archived) and for one that has not been saved yet. An answer that arrives after a
 * newer check started is dropped, so a slow check cannot show an older state.
 */
export function usePublishReadiness({
	entryId,
	version,
	enabled,
}: {
	entryId: string | undefined;
	version: number | undefined;
	enabled: boolean;
}): PublishReadiness {
	const site = useSite();
	const [result, setResult] = useState<PublishCheckResult | null>(null);
	const [checking, setChecking] = useState(false);
	const latest = useRef(0);

	const run = useCallback(async () => {
		if (!entryId) return;
		const own = ++latest.current;
		setChecking(true);
		try {
			const found = await checkEntryPublish(site, entryId);
			if (own === latest.current) setResult({ issues: found.issues ?? [], warnings: found.warnings ?? [] });
		} catch {
			if (own === latest.current) setResult(null);
		} finally {
			if (own === latest.current) setChecking(false);
		}
	}, [site, entryId]);

	// biome-ignore lint/correctness/useExhaustiveDependencies: `version` is the trigger: a save that changed the entry checks it again
	useEffect(() => {
		if (!enabled) {
			latest.current++;
			setResult(null);
			setChecking(false);
			return;
		}
		void run();
	}, [enabled, run, version]);

	const setBlocked = useCallback((issues: readonly CmsIssue[]) => {
		// A publish that was refused is newer than any check still on its way.
		latest.current++;
		setChecking(false);
		setResult((current) => ({ issues, warnings: current?.warnings ?? [] }));
	}, []);

	return { result, checking, recheck: () => void run(), setBlocked };
}
