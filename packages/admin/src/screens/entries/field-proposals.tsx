"use client";

import { createContext, useContext } from "react";
import type { FieldProposals } from "../../editor/proposals/use-proposal-marks";

const NONE: FieldProposals = { byField: new Map(), current: null };

const FieldProposalsContext = createContext<FieldProposals>(NONE);

/** The assistant's field changes the properties panel draws (flow 2 · 08), from the editor's proposals. */
export const FieldProposalsProvider = FieldProposalsContext.Provider;

/** The field changes drawn now, by field name, and the field the proposal bubble is on. */
export const useFieldProposals = (): FieldProposals => useContext(FieldProposalsContext);
