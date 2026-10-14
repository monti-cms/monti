/** The Tools pages of a site's plugins, in plugin order. */
export function toolsPages(site) {
    return site.plugins.flatMap((entry) => (entry.nav ?? []).map((item) => ({
        path: item.path.replace(/^\/+|\/+$/g, ""),
        href: site.adminHref(`/tools/${item.path.replace(/^\/+|\/+$/g, "")}`),
        label: typeof item.label === "function" ? item.label(site) : item.label,
        icon: item.icon,
    })));
}
