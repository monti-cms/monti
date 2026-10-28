"use client";

import { createContext, useContext } from "react";

/**
 * What a field input needs to know when it opens in place in the properties list: the assistant wrote its value and nobody has edited it (`proposal`: it
 * draws blue), and how it ends the edit (`done`: Enter, Escape, a closed list). Absent in a form, where the input is always there.
 */
export interface PropertyEdit {
	readonly proposal: boolean;
	readonly done: () => void;
}

export const PropertyEditContext = createContext<PropertyEdit | null>(null);

export const usePropertyEdit = (): PropertyEdit | null => useContext(PropertyEditContext);
