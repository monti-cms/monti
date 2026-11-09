/**
 * Why the library will not take a file: not a kind it takes, not a picture where only pictures go, nothing comes out of it (a folder from the OS, a broken picture), or over
 * the limit. Trying again would change nothing, so such a file takes no place on the page: a toast says so, at once (2026-11-09, owner).
 */
export type Refusal = "type" | "notImage" | "unreadable" | "tooBig";

/** One file on its way up, in its place on the page until it is an item of the library. */
export type Upload = {
	id: string;
	name: string;
	/** The folder it goes to: `null` is the top level. */
	folder: string | null;
	/** A place that takes only images: another file is refused, and stays out of the library. */
	only?: "image";
	/** The file's own picture, for what shows while it goes up. */
	preview: string | null;
	/** `failed`: cut off by the network or the server. It stays where it was, to try again as it is. */
	status: "waiting" | "uploading" | "failed";
	progress: number;
};

export type QueueAction =
	| { type: "add"; uploads: Upload[] }
	| { type: "start"; id: string }
	| { type: "progress"; id: string; percent: number }
	| { type: "failed"; id: string }
	| { type: "retry"; id: string }
	| { type: "remove"; id: string };

/** Files going up at once; the rest wait their turn. */
export const AT_ONCE = 3;

/** One file after an action that names it. */
function changed(upload: Upload, action: Exclude<QueueAction, { type: "add" | "remove" }>): Upload {
	switch (action.type) {
		case "start":
			return { ...upload, status: "uploading", progress: 0 };
		case "progress":
			return upload.status === "uploading" ? { ...upload, progress: action.percent } : upload;
		case "failed":
			return { ...upload, status: "failed" };
		case "retry":
			return { ...upload, status: "waiting", progress: 0 };
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

/** The files still on their way: leaving now would lose them. */
export const stillGoing = (queue: Upload[]) =>
	queue.filter((upload) => upload.status === "waiting" || upload.status === "uploading");
