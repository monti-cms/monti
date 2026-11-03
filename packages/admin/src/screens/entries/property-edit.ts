"use client";

import { createContext, useContext } from "react";

/**
 * What a field input needs to know in the properties list: the assistant wrote or proposes its value and nobody has edited it (`proposal`: it draws
 * blue). Absent in a form, where the form field says it itself.
 */
export interface PropertyEdit {
	readonly proposal: boolean;
}

export const PropertyEditContext = createContext<PropertyEdit | null>(null);

export const usePropertyEdit = (): PropertyEdit | null => useContext(PropertyEditContext);
