import { useContext, useMemo } from "react";
import type { Catalog } from "../../editor/catalog";
import { ReadCatalog } from "../../editor/read-catalog";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import type { BlockNames } from "./compare-entries";

/** The site's names for blocks and their values from its catalog, in the admin's language; a file by its name in the library, not its id. */
export function blockNamesOf(
	kit: Catalog,
	t: ReturnType<typeof useAdmin>["t"],
	files: readonly { id: string; name: string }[] = [],
): BlockNames {
	const named = new Map(files.map((file) => [file.id, file.name]));
	return {
		block: (type: string) => kit.blocks.find((block) => block.type === type),
		say: (label) => t(label),
		file: (media: string) => named.get(media),
	};
}

/**
 * The site's names for blocks and their values (doc 18, T197), from `blocks.catalog` in the admin's language: the compare, the review and the
 * translation's source say a block's kind and its values with them. `undefined` until the catalog is read.
 */
export function useBlockNames(files: readonly { id: string; name: string }[] = []): BlockNames | undefined {
	const { t } = useAdmin();
	// The catalog is read once for the screens that read bodies (`ReadBodies`); without that, here.
	const shared = useContext(ReadCatalog);
	const own = useRead<Catalog>("blocks.catalog", {}, { skip: shared !== null }).data;
	const kit = (shared ? shared.kit : own) ?? undefined;
	// A picture or a file is named by its file's name, as the media field shows it, not by its library id.
	const known = files.map((file) => `${file.id}\u0000${file.name}`).join("\u0001");
	// biome-ignore lint/correctness/useExhaustiveDependencies: the files are followed by what they are (`known`), not by the array's identity
	return useMemo(() => (kit ? blockNamesOf(kit, t, files) : undefined), [kit, t, known]);
}
