import type { DeliveriesRetried } from "@monti-cms/core";
import { toast } from "@monti-cms/ui";
import { useState } from "react";
import { useAdmin } from "../operations/admin-context";
import { reasonOf, useOperation } from "../operations/use-operation";

/**
 * Sends failed deliveries again (doc 13, flow 12): a line's, one delivery's, or all of them. The server takes a batch at a time and says how many
 * are left, so this asks until none is; what a step sent stays sent if the page goes away in between. `sending` names what is on its way, for the
 * rows and every send control to say so: one send runs at a time, and while it does no other is offered to be pressed into nothing. The toast says
 * how it came out; a delivery that failed again is still on its row.
 */
export function useSendAgain() {
	const { t, wrote } = useAdmin();
	const retry = useOperation<{ output: DeliveriesRetried }>("deliveries.retry");
	const [sending, setSending] = useState<readonly string[] | "all" | null>(null);
	const send = async (ids: readonly string[] | "all") => {
		if (sending !== null) return;
		setSending(ids);
		try {
			let sent = 0;
			let failed = 0;
			let run: string | undefined;
			/** How it came out so far, in words; `null` when nothing was sent or tried. */
			const tally = () =>
				sent + failed === 0
					? null
					: sent + failed === 1
						? t(failed ? "activity.sendFailed" : "activity.sent")
						: failed === 0
							? t("activity.sentCount", { count: sent })
							: sent === 0
								? t("activity.failedCount", { count: failed })
								: t("activity.sentSome", { sent, failed });
			for (;;) {
				const result = await retry.run({ ...(ids === "all" ? { all: true } : { ids }), ...(run ? { run } : {}) });
				if (!result.ok) {
					// What the screen shows is behind (it was sent by itself in the meantime, canceled in another tab): everything reads again.
					wrote();
					const reason = t(reasonOf(result.refusal));
					const before = tally();
					// Refused at the start with a reason, it only says why. Refused part-way, what the earlier steps did is said with it, as the
					// error it is; and an answer that never came (no reason) is an error too.
					if (before !== null) return void toast.error(`${before} · ${reason}`);
					return void (result.refusal.reason ? toast(reason) : toast.error(reason));
				}
				const step = result.body.output;
				sent += step.sent;
				failed += step.failed;
				run = step.run;
				if (step.remaining === 0 || step.ids.length === 0) break;
			}
			const words = tally();
			if (words === null) return;
			if (failed > 0 && (sent === 0 || sent + failed === 1)) toast.error(words);
			else toast(words);
		} finally {
			setSending(null);
		}
	};
	return { send, sending };
}
