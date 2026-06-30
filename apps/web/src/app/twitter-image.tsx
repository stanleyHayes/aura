// Twitter card image (§12.1): re-uses the default Open Graph image so the
// Twitter "summary_large_image" card matches the OG preview. The generator and
// its `alt`/`size`/`contentType` config are re-exported from a single source of
// truth; `runtime` is declared locally because Next.js requires route-segment
// config to be statically parseable (it cannot be re-exported).
export const runtime = "nodejs";
export { default, alt, size, contentType } from "./opengraph-image";
