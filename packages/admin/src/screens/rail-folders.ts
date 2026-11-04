import type { Folder } from "@monti-cms/core/site";

/**
 * The folders the rail shows under the open collection: the top-level ones only. A folder inside another is reached from its parent's view (the path
 * line and the folder rows above the list), so the rail stays one flat list however deep the tree grows.
 */
export function railFolders<F extends Folder>(folders: readonly F[]): F[] {
	return folders.filter((folder) => folder.parentId === null);
}

/**
 * The folders on the way to `folderId`, the top-level one first and `folderId` itself last: the path shown above a folder's view. Empty for the top level
 * (`all`) and for a folder that is not known. A loop in the data ends the walk.
 */
export function folderPath<F extends Folder>(folders: readonly F[], folderId: string): F[] {
	const path: F[] = [];
	const seen = new Set<string>();
	for (let at = folders.find((folder) => folder.id === folderId); at && !seen.has(at.id); ) {
		path.unshift(at);
		seen.add(at.id);
		const parentId: string | null = at.parentId;
		at = parentId === null ? undefined : folders.find((folder) => folder.id === parentId);
	}
	return path;
}
