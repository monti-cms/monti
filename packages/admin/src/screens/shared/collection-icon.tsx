"use client";

import { useSite } from "@monti-cms/core/site";
import type { MontiIcon } from "@monti-cms/ui";
import { Document, iconsByName, Tag } from "@monti-cms/ui/icons";
import { useCallback } from "react";
import { useAdminComponents } from "../../admin-components";

/**
 * Function that picks an icon by name. Looks at registered icons (`AdminComponents.icons`) first, then the built-in icons.
 * `undefined` for an unknown name.
 */
export function useIconByName(): (name: string | undefined) => MontiIcon | undefined {
	const { icons } = useAdminComponents();
	return useCallback((name) => (name ? (icons?.[name] ?? iconsByName[name]) : undefined), [icons]);
}

export function CollectionIcon({ collection }: { collection: string }) {
	const site = useSite();
	const iconByName = useIconByName();
	const name = site.isCollection(collection) ? site.schemaOf(collection).icon : undefined;
	const Icon = iconByName(name) ?? (site.isItemCollection(collection) ? Tag : Document);
	return <Icon />;
}
