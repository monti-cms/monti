"use client";
import { jsx as _jsx } from "react/jsx-runtime";
import { useTranslator } from "@monti-cms/core/client";
import { AdminShell } from "../shared/admin-shell.js";
import { ApiKeysSettings } from "./api-keys-settings.js";
import { apiKeysMessages } from "./messages.js";
/** The API keys page: the shared frame (sidebar, title) around the key store. */
export function ApiKeysPageScreen() {
    const t = useTranslator(apiKeysMessages);
    return (_jsx(AdminShell, { title: t("title"), sidebar: { activeNav: "api-keys" }, children: _jsx(ApiKeysSettings, {}) }));
}
