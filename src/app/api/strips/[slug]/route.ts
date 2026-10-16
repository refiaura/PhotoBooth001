import { findStripsBySlug, storage } from "@/server/booth-repo";
import { ApiError, handler, json } from "@/server/http";

const SLUG = /^[A-Za-z0-9_-]{22}$/;
const SIGNED_URL_SECONDS = 10 * 60;

/** Data photostrip + signed URL berumur pendek (bucket privat). Slug acak 22 karakter. */
export const GET = handler(async (_request: Request, ctx: RouteContext<"/api/strips/[slug]">) => {
  const { slug } = await ctx.params;
  if (!SLUG.test(slug)) throw new ApiError(404, "NOT_FOUND");

  const strips = await findStripsBySlug(slug);
  const strip = strips.find((s) => s.format === "strip");
  if (!strip) throw new ApiError(404, "NOT_FOUND");

  const [view, download] = await Promise.all([
    storage().createSignedUrl(strip.storage_key, SIGNED_URL_SECONDS),
    storage().createSignedUrl(strip.storage_key, SIGNED_URL_SECONDS, {
      download: `rindu-berat-${slug.slice(0, 8)}.png`,
    }),
  ]);
  if (view.error) throw view.error;
  if (download.error) throw download.error;

  return json({
    slug,
    strip: { url: view.data.signedUrl, downloadUrl: download.data.signedUrl },
    createdAt: Date.parse(strip.created_at),
    expiresAt: Date.parse(strip.expires_at),
  });
});
