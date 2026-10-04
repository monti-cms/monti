"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { createContext, useContext } from "react";
const AdminFeaturesContext = createContext({ media: true });
export function AdminFeaturesProvider({ features, children }) {
    return _jsx(AdminFeaturesContext.Provider, { value: features, children: children });
}
export const useAdminFeatures = () => useContext(AdminFeaturesContext);
