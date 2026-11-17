import { readGeneratedImage } from "@/lib/template-store";

export async function GET(
  _request: Request,
  context: RouteContext<"/api/generated/[filename]">,
) {
  const { filename } = await context.params;
  const image = await readGeneratedImage(filename);
  if (!image) return new Response("图片不存在或已按隐私规则删除", { status: 404 });

  return new Response(new Uint8Array(image.buffer), {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "private, no-store, max-age=0",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
