import type { ApplyProgress } from "./apply";
import { type ProposalView, proposalView } from "./proposal-view";
import type { Proposal } from "./proposals";

/** One line of an apply or undo answer: a step done, or the proposal at the end. */
export type ProgressLine =
	| { readonly type: "progress"; readonly done: number; readonly total: number }
	| { readonly type: "done"; readonly proposal: ProposalView }
	| { readonly type: "error"; readonly code: string; readonly message: string };

/**
 * Answers with one JSON line per step (`{ type: "progress", done, total }`) and the proposal at the end (`{ type: "done" }`), so the review shows "Applying 9 /
 * 17" while it works. A failure of the whole run (not of one item, which the proposal records) ends with `{ type: "error" }`.
 */
export function progressResponse(work: (onProgress: (progress: ApplyProgress) => void) => Promise<Proposal>): Response {
	const encoder = new TextEncoder();
	const body = new ReadableStream<Uint8Array>({
		async start(controller) {
			const send = (line: ProgressLine) => controller.enqueue(encoder.encode(`${JSON.stringify(line)}\n`));
			try {
				const proposal = await work(({ done, total }) => send({ type: "progress", done, total }));
				send({ type: "done", proposal: proposalView(proposal) });
			} catch (error) {
				const code =
					typeof (error as { code?: unknown }).code === "string" ? (error as { code: string }).code : "internal_error";
				send({ type: "error", code, message: error instanceof Error ? error.message : "Failed" });
			} finally {
				controller.close();
			}
		},
	});
	return new Response(body, { headers: { "content-type": "application/x-ndjson", "cache-control": "no-store" } });
}
