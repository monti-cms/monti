import { defineAdminPlugin } from "@monti-cms/admin";
import type { ComponentType, ReactNode } from "react";

/**
 * The admin module of a block plugin: its provider registers the editing view, menu icon or marks of the block. The provider is a `"use client"` component that wraps
 * the admin.
 */
export const defineBlockAdmin = (Provider: ComponentType<{ children: ReactNode }>) => defineAdminPlugin({ Provider });
