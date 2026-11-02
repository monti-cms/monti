"use client";

import { type ComponentType, createContext, type ReactNode, useContext, useMemo } from "react";

/**
 * Sections plugins add to the API keys page, by name, drawn after the saved keys (`defineAdminPlugin({ keySections: { models: ModelSection } })`): the AI
 * plugin's Models section with the quick-task model. A section renders a `TableSection` from `@monti-cms/admin/kit`.
 */
export type KeySections = Readonly<Record<string, ComponentType>>;

const KeySectionsContext = createContext<KeySections>({});

/** Adds a plugin's sections to the ones outside it (inner wins on the same name). */
export function KeySectionsProvider({ sections, children }: { sections: KeySections; children: ReactNode }) {
	const parent = useContext(KeySectionsContext);
	const value = useMemo(() => ({ ...parent, ...sections }), [parent, sections]);
	return <KeySectionsContext.Provider value={value}>{children}</KeySectionsContext.Provider>;
}

export const useKeySections = (): KeySections => useContext(KeySectionsContext);
