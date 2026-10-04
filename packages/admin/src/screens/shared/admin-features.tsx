"use client";

import { createContext, type ReactNode, useContext } from "react";

/** Admin features toggled by server settings. The server layout decides and passes them down so the screen draws correctly from the start. */
export interface AdminFeatures {
	/** Whether there is a media storage (`media` in `cms.server.ts`). */
	media: boolean;
}

const AdminFeaturesContext = createContext<AdminFeatures>({ media: true });

export function AdminFeaturesProvider({ features, children }: { features: AdminFeatures; children: ReactNode }) {
	return <AdminFeaturesContext.Provider value={features}>{children}</AdminFeaturesContext.Provider>;
}

export const useAdminFeatures = (): AdminFeatures => useContext(AdminFeaturesContext);
