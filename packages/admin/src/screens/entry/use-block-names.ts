import { useMemo } from "react";
import type { Catalog } from "../../editor/catalog";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import type { BlockNames } from "./compare-entries";

/**
 * The site's names for blocks and their values (doc 18, T197), from `blocks.catalog` in the admin's language: the compare, the review and the
 * translation's source say a block's kind and its values with them. `undefined` until the catalog is read.
 */
export function useBlockNames(files: readonly { id: string; name: string }[] = []): BlockNames | undefined {
	const { t } = useAdmin();
	const catalog = useRead<Catalog>("blocks.catalog", {});
	// A picture or a file is named by its file's name, as the media field shows it, not by its library id.
	const known = files.map((file) => `${file.id}\u0000${file.name}`).join("\u0001");
	// biome-ignore lint/correctness/useExhaustiveDependencies: the files are followed by what they are (`known`), not by the array's identity
	return useMemo(() => {
		const kit = catalog.data;
		if (!kit) return undefined;
		const named = new Map(files.map((file) => [file.id, file.name]));
		return {
			block: (type: string) => kit.blocks.find((block) => block.type === type),
			say: (label) => t(label),
			file: (media: string) => named.get(media),
		};
	}, [catalog.data, t, known]);
}
