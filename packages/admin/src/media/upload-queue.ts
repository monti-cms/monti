import type { Acceptance } from "@monti-cms/core";

/**
 * Why a file did not go up.
 * - `type`: not a kind the library takes. `unreadable`: it says it is a picture, and no picture comes out of it. Those two can only be taken out.
 * - `tooBig`: over the limit. It can only be taken out too: a smaller file is another upload.
 * - `failed`: the network or the server; it can be tried again as it is.
 */
export type UploadProblem = "type" | "heic" | "notImage" | "cannotRead" | "unreadable" | "tooBig" | "failed";

/** One file on its way up, in its place on the page until it is an item of the library. */
export type Upload = {
	id: string;
	name: string;
	/** The folder it goes to: `null` is the top level. */
	folder: string | null;
	/** A place that takes only images: another file stays with its reason, and out of the library. */
	only?: "image";
	/** The file's own picture, for what shows while it goes up. */
	preview: string | null;
	status: "waiting" | "uploading" | "failed" | "interrupted";
	progress: number;
	problem: UploadProblem | null;
};

export type QueueAction =
	| { type: "add"; uploads: Upload[] }
	| { type: "start"; id: string }
	| { type: "progress"; id: string; percent: number }
	| { type: "problem"; id: string; problem: UploadProblem }
	| { type: "retry"; id: string }
	| { type: "remove"; id: string };

/** Files going up at once; the rest wait their turn. */
export const AT_ONCE = 3;

const STATUS_OF: Record<UploadProblem, "failed" | "interrupted"> = {
	type: "failed",
	heic: "failed",
	notImage: "failed",
	cannotRead: "failed",
	unreadable: "failed",
	tooBig: "interrupted",
	failed: "interrupted",
};

/** One file after an action that names it. */
function changed(upload: Upload, action: Exclude<QueueAction, { type: "add" | "remove" }>): Upload {
	switch (action.type) {
		case "start":
			return { ...upload, status: "uploading", progress: 0, problem: null };
		case "progress":
			return upload.status === "uploading" ? { ...upload, progress: action.percent } : upload;
		case "problem":
			return {
				...upload,
				status: STATUS_OF[action.problem],
				problem: action.problem,
			};
		case "retry":
			return { ...upload, status: "waiting", progress: 0, problem: null };
	}
}

export function uploadQueue(queue: Upload[], action: QueueAction): Upload[] {
	if (action.type === "add") return [...queue, ...action.uploads];
	if (action.type === "remove") return queue.filter((upload) => upload.id !== action.id);
	return queue.map((upload) => (upload.id === action.id ? changed(upload, action) : upload));
}

/** The files to start now, in the order they came, keeping to `AT_ONCE`. */
export function nextToStart(queue: Upload[]): Upload[] {
	const going = queue.filter((upload) => upload.status === "uploading").length;
	return queue.filter((upload) => upload.status === "waiting").slice(0, Math.max(0, AT_ONCE - going));
}

/** What the library's answer about a file means for its place in the queue. */
export const problemOf = (answer: Acceptance): UploadProblem | null =>
	answer.ok ? null : answer.reason === "size" ? "tooBig" : answer.reason;

/** The files still on their way: leaving now would lose them. */
export const stillGoing = (queue: Upload[]) =>
	queue.filter((upload) => upload.status === "waiting" || upload.status === "uploading");
