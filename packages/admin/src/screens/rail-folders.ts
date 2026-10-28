import type { Folder } from "@monti-cms/core/site";

export interface RailFolder {
	readonly folder: Folder;
	/** 0 for a top-level folder, 1 for one inside it, and so on. */
	readonly depth: number;
}

/**
 * The folders the rail shows under the open collection, top to bottom: every top-level folder, and the folders inside each folder on the way to the
 * open one (and inside the open one itself), right under their parent. A folder beside the open path stays closed, so the rail never grows into the
 * whole tree. `currentFolder` is a folder ID, or `all` for none.
 */
export function railFolders(folders: readonly Folder[], currentFolder: string): RailFolder[] {
	const byParent = new Map<string | null, Folder[]>();
	for (const folder of folders) {
		const siblings = byParent.get(folder.parentId) ?? [];
		siblings.push(folder);
		byParent.set(folder.parentId, siblings);
	}
	const open = new Set<string>();
	let walk = folders.find((folder) => folder.id === currentFolder);
	while (walk) {
		open.add(walk.id);
		const parentId = walk.parentId;
		walk = parentId === null ? undefined : folders.find((folder) => folder.id === parentId);
	}
	const rows: RailFolder[] = [];
	const add = (parentId: string | null, depth: number) => {
		for (const folder of byParent.get(parentId) ?? []) {
			rows.push({ folder, depth });
			if (open.has(folder.id)) add(folder.id, depth + 1);
		}
	};
	add(null, 0);
	return rows;
}
