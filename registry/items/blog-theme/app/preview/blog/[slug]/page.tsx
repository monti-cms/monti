import { BlogPostPreviewPage, generateBlogPostPreviewMetadata } from "@/registry/monti/blog-theme/blog-post";

// The preview reads the draft of the signed-in admin, so it is never cached: `BlogPostPage` waits for the request (`connection()`) inside a `Suspense`
// boundary, which also keeps it valid under Next's `cacheComponents`. The address is `site.previewPath` (here `/preview`) plus the post's public path.
export const generateMetadata = generateBlogPostPreviewMetadata;

export default BlogPostPreviewPage;

// Only valid with cacheComponents: `monti add` keeps this line when next.config turns it on and drops it otherwise.
export const instant = false; // monti:cache-components
