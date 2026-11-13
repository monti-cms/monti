import { useMemo } from "react";
import type { Catalog } from "../../editor/catalog";
import { useAdmin } from "../../operations/admin-context";
import { useRead } from "../../operations/use-operation";
import type { BlockNames } from "./compare-entries";

/**
 * The site's names for blocks and their values (doc 18, T197), from `blocks.catalog` in the admin's language: the compare, the review and the
 * translation's source say a block's kind and its values with them. `undefined` until the catalog is read.
 */
export function useBlockNames(): BlockNames | undefined {
	const { t } = useAdmin();
	const catalog = useRead<Catalog>("blocks.catalog", {});
	return useMemo(() => {
		const kit = catalog.data;
		if (!kit) return undefined;
		return { block: (type: string) => kit.blocks.find((block) => block.type === type), say: (label) => t(label) };
	}, [catalog.data, t]);
}
