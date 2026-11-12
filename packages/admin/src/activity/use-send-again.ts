import type { DeliveriesRetried } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { useOperation } from "../operations/use-operation";

/**
 * Sends failed deliveries again (doc 13, flow 12): a line's, one delivery's, or all of them. The server takes a batch at a time and says how many
 * are left, so this asks until none is; what a step sent stays sent if the page goes away in between. `sending` names what is on its way, for the
 * row and the banner to say so. The toast says how it came out; a delivery that failed again is still on its row.
 */
export function useSendAgain() {
	const { t } = useAdmin();
	const retry = useOperation<{ output: DeliveriesRetried }>("deliveries.retry");
	const [sending, setSending] = useState<readonly string[] | "all" | null>(null);
	const send = async (ids: readonly string[] | "all") => {
		if (sending !== null) return;
		setSending(ids);
		try {
			let sent = 0;
			let failed = 0;
			let run: string | undefined;
			for (;;) {
				const result = await retry.run({ ...(ids === "all" ? { all: true } : { ids }), ...(run ? { run } : {}) });
				// Sent by itself in the meantime, or canceled: it says which, and the list reads again.
				if (!result.ok) return void toast(t(result.refusal.reason ?? "errors.unexpected"));
				const step = result.body.output;
				sent += step.sent;
				failed += step.failed;
				run = step.run;
				if (step.remaining === 0 || step.ids.length === 0) break;
			}
			if (sent + failed === 0) return;
			if (sent + failed === 1) return void (failed ? toast.error(t("activity.sendFailed")) : toast(t("activity.sent")));
			if (failed === 0) toast(t("activity.sentCount", { count: sent }));
			else if (sent === 0) toast.error(t("activity.failedCount", { count: failed }));
			else toast(t("activity.sentSome", { sent, failed }));
		} finally {
			setSending(null);
		}
	};
	return { send, sending };
}
