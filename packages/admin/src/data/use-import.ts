import { type Imported, type ImportFile, type Inspected, type Message, unzip } from "@monti-cms/core";
import { useCallback, useRef, useState } from "react";
import { type PutFile, putFile } from "../media/put-file";
import { useAdmin } from "../operations/admin-context";
import { type Refusal, reasonOf, useOperation } from "../operations/use-operation";

/** What was chosen, read in the browser: its text files as they are, the names of the rest, and a way to the bytes of one of them. */
type Upload = {
	name: string;
	files: ImportFile[];
	has: string[];
	read: (file: string) => Promise<Uint8Array | null>;
};

/** An upload that could be read, and what importing it would do. */
type Readable = Extract<Inspected, { kind: "monti" | "files" }>;

export type ImportState =
	| { step: "reading"; name: string }
	| { step: "unreadable"; name: string; reason: Message }
	| { step: "ready"; name: string; inspected: Readable; mapping: Record<string, string | null> }
	| { step: "importing"; name: string; inspected: Readable; mapping: Record<string, string | null>; sent: number }
	| { step: "done"; name: string; result: Imported; pictures: number; activityId: string };

/** Files that are not text: pictures and the other things a library holds. A Monti file keeps them under `media/`. */
const NOT_TEXT =
	/\.(png|jpe?g|gif|webp|avif|svg|ico|bmp|tiff?|heic|mp4|mov|webm|mp3|wav|ogg|pdf|zip|gz|woff2?|ttf|otf)$/i;
/** What an operating system leaves in a zip beside the files. */
const JUNK = /(^|\/)(__MACOSX\/|\.DS_Store$|Thumbs\.db$)/;

const isText = (name: string) => !name.startsWith("media/") && !NOT_TEXT.test(name);
const baseName = (path: string) => path.slice(path.lastIndexOf("/") + 1);

/**
 * Reads what a person chose (doc 14): one zip is opened and its files are the upload; anything else is the upload as chosen (a `.md`, or a
 * few of them with their pictures). `null` when a zip cannot be opened.
 */
export async function readChosen(chosen: File[]): Promise<Upload | null> {
	const [first, ...more] = chosen;
	if (!first) return null;
	const decoder = new TextDecoder();
	if (more.length === 0 && /\.zip$/i.test(first.name)) {
		const zip = unzip(new Uint8Array(await first.arrayBuffer()));
		if (!zip) return null;
		const names = zip.names.filter((name) => !name.endsWith("/") && !JUNK.test(name));
		const files: ImportFile[] = [];
		for (const name of names.filter(isText)) {
			const bytes = await zip.read(name);
			if (bytes) files.push({ name, text: decoder.decode(bytes) });
		}
		return { name: first.name, files, has: names.filter((name) => !isText(name)), read: zip.read };
	}
	const byName = new Map(chosen.map((file) => [file.name, file]));
	const files: ImportFile[] = [];
	for (const file of chosen) if (isText(file.name)) files.push({ name: file.name, text: await file.text() });
	return {
		name: first.name,
		files,
		has: chosen.filter((file) => !isText(file.name)).map((file) => file.name),
		read: async (name) => {
			const file = byName.get(name);
			return file ? new Uint8Array(await file.arrayBuffer()) : null;
		},
	};
}

/**
 * An import into one collection (doc 14, flow 9 05–09): the chosen files are read here, `data.inspect` says what importing them would do,
 * a field picked for a key asks it again, and `go` sends the upload's pictures up and runs `data.import` with them. Nothing is written
 * before `go`.
 */
export function useImport(collection: string) {
	const { t, uploader } = useAdmin();
	const inspect = useOperation<Inspected>("data.inspect");
	const run = useOperation<{ output: Imported; activityId: string }>("data.import");
	const [state, setState] = useState<ImportState | null>(null);
	const upload = useRef<Upload | null>(null);
	/** The read in progress: an answer to an older one (a file chosen again, a field picked twice) is dropped. */
	const turn = useRef(0);

	const look = useCallback(
		async (name: string, mapping: Record<string, string | null> | undefined) => {
			const at = upload.current;
			if (!at) return;
			const mine = ++turn.current;
			const answer = await inspect.run({ collection, files: at.files, has: at.has, mapping });
			if (mine !== turn.current) return;
			if (!answer.ok) return setState({ step: "unreadable", name, reason: reasonOf(answer.refusal) });
			if (answer.body.kind === "unreadable") return setState({ step: "unreadable", name, reason: answer.body.reason });
			const inspected = answer.body;
			setState({
				step: "ready",
				name,
				inspected,
				mapping: Object.fromEntries(inspected.keys.map((key) => [key.key, key.field])),
			});
		},
		[collection, inspect.run],
	);

	const open = useCallback(
		async (chosen: File[]) => {
			const [first] = chosen;
			if (!first) return;
			const name = chosen.length === 1 ? first.name : t("import.many", { name: first.name, count: chosen.length - 1 });
			turn.current += 1;
			setState({ step: "reading", name });
			const read = await readChosen(chosen).catch(() => null);
			upload.current = read;
			if (!read) return setState({ step: "unreadable", name, reason: { key: "data.unreadable" } });
			await look(name, undefined);
		},
		[look, t],
	);

	/** A key goes to another field, or to none. */
	const map = (key: string, field: string | null) => {
		if (state?.step !== "ready") return;
		const mapping = { ...state.mapping, [key]: field };
		setState({ ...state, mapping });
		void look(state.name, mapping);
	};

	/** Imports. Answers the refusal when the import did not go through (the sheet is back where it was). */
	const go = async (): Promise<Refusal | null> => {
		const at = upload.current;
		if (state?.step !== "ready" || !at) return null;
		const { name, inspected, mapping } = state;
		setState({ step: "importing", name, inspected, mapping, sent: 0 });
		// The upload's pictures first: their bytes go up as any file's do, and the import makes the library's files of them.
		const uploaded: Record<string, PutFile & { name: string }> = {};
		for (const [index, picture] of inspected.pictures.entries()) {
			const bytes = await at.read(picture.file);
			if (bytes) {
				const file = new File([bytes as Uint8Array<ArrayBuffer>], baseName(picture.file));
				const put = await putFile(file, uploader);
				// A picture the library will not take is left out, as one the upload does not have.
				if (put.ok)
					uploaded[picture.name] = {
						name: file.name,
						original: put.original,
						...(put.web ? { web: put.web } : {}),
						...(put.placeholder ? { placeholder: put.placeholder } : {}),
					};
			}
			setState({ step: "importing", name, inspected, mapping, sent: index + 1 });
		}
		const answer = await run.run({
			collection,
			name,
			files: at.files,
			has: at.has,
			mapping,
			uploaded,
			mediaFolder: t("import.folder"),
		});
		if (!answer.ok) {
			setState({ step: "ready", name, inspected, mapping });
			return answer.refusal;
		}
		setState({
			step: "done",
			name,
			result: answer.body.output,
			pictures: Object.keys(uploaded).length,
			activityId: answer.body.activityId,
		});
		return null;
	};

	const close = () => {
		turn.current += 1;
		upload.current = null;
		setState(null);
	};

	return { state, open, map, go, close };
}
