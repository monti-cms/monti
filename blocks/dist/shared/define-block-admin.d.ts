import type { ComponentType, ReactNode } from "react";
/**
 * The admin module of a block plugin: its provider registers the editing view, menu icon or marks of the block. The provider is a `"use client"` component that wraps
 * the admin.
 */
export declare const defineBlockAdmin: (Provider: ComponentType<{
    children: ReactNode;
}>) => import("@monti-cms/admin/plugins").CmsAdminPlugin;
