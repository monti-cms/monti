/**
 * Next 앱에 관리자 화면을 붙이는 진입점(서버 컴포넌트).
 *
 * ```tsx
 * // app/(admin)/admin/layout.tsx
 * import "../../globals.css";
 * export { CmsAdminLayout as default, cmsAdminMetadata as metadata } from "@monti-cms/admin/next";
 *
 * // app/(admin)/admin/[[...path]]/page.tsx
 * export { CmsAdminPage as default } from "@monti-cms/admin/next";
 * ```
 */
export { CmsAdminLayout, type CmsAdminLayoutProps, cmsAdminMetadata } from "./layout";
export { CmsAdminPage, type CmsAdminPageProps } from "./page";
