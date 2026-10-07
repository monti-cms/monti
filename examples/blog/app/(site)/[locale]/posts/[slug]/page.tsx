import { BlogPostPage, generateBlogPostMetadata } from "@/components/monti/blog-theme/blog-post";

// Route segment settings are written here, not re-exported: the posts are read from the database on each request.
export const dynamic = "force-dynamic";

export const generateMetadata = generateBlogPostMetadata;

export default BlogPostPage;
