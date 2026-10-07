import { BlogPostPreviewPage, generateBlogPostPreviewMetadata } from "@/registry/monti/blog-theme/blog-post";

// The preview reads the draft of the signed-in admin, so it is never cached: `BlogPostPage` waits for the request (`connection()`) inside a `Suspense`
// boundary, which also keeps it valid under Next's `cacheComponents`. The address is `site.previewPath` (here `/preview`) plus the post's public path.
export const generateMetadata = generateBlogPostPreviewMetadata;

export default BlogPostPreviewPage;
