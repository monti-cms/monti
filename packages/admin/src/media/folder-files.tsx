import { createContext, useContext, useEffect, useMemo, useRef } from "react";

/** What the open media screen does with files over a folder that is not on it: says where they would land, and sends them up when they do. */
type Taker = {
	/** The folder the files are over now, by name, or `null` once they have left it. */
	over: (name: string | null) => void;
	files: (files: File[], folder: string) => void;
};

const FolderFiles = createContext<{ current: Taker | null } | null>(null);

/**
 * Lets a folder outside the media screen take files (the sidebar's folder rows, doc 07): sending files up is the screen's (`useUpload`: its tiles, its bars, its
 * question on leaving), so the frame hands the files to the screen that is open. Around the frame and its screen.
 */
export function FolderFilesProvider({ children }: { children: React.ReactNode }) {
	const taker = useRef<Taker | null>(null);
	return <FolderFiles value={taker}>{children}</FolderFiles>;
}

/** The media screen takes the files dropped on folders outside it, while it is open. */
export function useTakeFolderFiles(taker: Taker) {
	const holder = useContext(FolderFiles);
	const latest = useRef(taker);
	latest.current = taker;
	useEffect(() => {
		if (!holder) return;
		const mine: Taker = {
			over: (name) => latest.current.over(name),
			files: (files, folder) => latest.current.files(files, folder),
		};
		holder.current = mine;
		return () => {
			if (holder.current === mine) holder.current = null;
		};
	}, [holder]);
}

/** The way from a folder outside the media screen to it. With no media screen open the files go nowhere: a folder of the library shows only while it is. */
export function useGiveFolderFiles(): Taker {
	const holder = useContext(FolderFiles);
	return useMemo(
		() => ({
			over: (name) => holder?.current?.over(name),
			files: (files, folder) => holder?.current?.files(files, folder),
		}),
		[holder],
	);
}
