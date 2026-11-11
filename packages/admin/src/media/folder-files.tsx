import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";

/** What the open media screen does with files over a folder that is not on it: says where they would land, and sends them up when they do. */
type Taker = {
	/** The folder the files are over now, by name, or `null` once they have left it. */
	over: (name: string | null) => void;
	files: (files: File[], folder: string) => void;
};

const FolderFiles = createContext<{ taker: Taker | null; setTaker: (taker: Taker | null) => void } | null>(null);

/**
 * Lets a folder outside the media screen take files (the sidebar's folder rows, doc 07): sending files up is the screen's (`useUpload`: its tiles, its bars, its
 * question on leaving), so the frame hands the files to the screen that is open. Around the frame and its screen.
 */
export function FolderFilesProvider({ children }: { children: React.ReactNode }) {
	const [taker, setTaker] = useState<Taker | null>(null);
	const value = useMemo(() => ({ taker, setTaker }), [taker]);
	return <FolderFiles value={value}>{children}</FolderFiles>;
}

/**
 * The media screen takes the files dropped on folders outside it, while it is open and can send files up: `null` (no storage) takes none, and those folders then
 * refuse the drag as they did before.
 */
export function useTakeFolderFiles(taker: Taker | null) {
	const setTaker = useContext(FolderFiles)?.setTaker;
	// The last one given: when it stops taking (`null`), this is still the one to tell that no files are over a folder any more.
	const latest = useRef(taker);
	if (taker) latest.current = taker;
	const takes = taker !== null;
	useEffect(() => {
		if (!setTaker || !takes) return;
		setTaker({
			over: (name) => latest.current?.over(name),
			files: (files, folder) => latest.current?.files(files, folder),
		});
		return () => {
			latest.current?.over(null);
			setTaker(null);
		};
	}, [setTaker, takes]);
}

/** The way from a folder outside the media screen to it, or `null` while no screen takes files: the folder then takes none. */
export function useGiveFolderFiles(): Taker | null {
	return useContext(FolderFiles)?.taker ?? null;
}
