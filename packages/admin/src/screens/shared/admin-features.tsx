"use client";

import { createContext, type ReactNode, useContext } from "react";

/** 서버 설정에 따라 켜고 끄는 관리자 기능. 서버 레이아웃이 정해 내려 주므로 화면이 처음부터 맞게 그려진다. */
export interface AdminFeatures {
	/** 미디어 저장소(`cms.server.ts`의 `media`)가 있는가. */
	media: boolean;
}

const AdminFeaturesContext = createContext<AdminFeatures>({ media: true });

export function AdminFeaturesProvider({ features, children }: { features: AdminFeatures; children: ReactNode }) {
	return <AdminFeaturesContext.Provider value={features}>{children}</AdminFeaturesContext.Provider>;
}

export const useAdminFeatures = (): AdminFeatures => useContext(AdminFeaturesContext);
