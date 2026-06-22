/**
 * Image URL Resolver for Vertex AI
 * Fetches images from URLs and converts to base64 inline data
 * Required for Vertex AI API calls
 */

export async function resolveImageUrls(contents: any): Promise<any> {
  const resolveParts = (parts: any[]) =>
    Promise.all(parts.map(async (part: any) => {
      if (!part._imageUrl) return part;
      
      try {
        const r = await fetch(part._imageUrl);
        if (!r.ok) throw new Error(`Image fetch failed: ${r.status}`);
        const buf = await r.arrayBuffer();
        return {
          inlineData: {
            data: Buffer.from(buf).toString('base64'),
            mimeType: r.headers.get('content-type') || 'image/jpeg'
          }
        };
      } catch (error) {
        console.error('Failed to resolve image URL:', part._imageUrl, error);
        return part; // Return original part on error
      }
    }));

  if (Array.isArray(contents)) {
    return Promise.all(contents.map(async (c: any) =>
      c?.parts ? { ...c, parts: await resolveParts(c.parts) } : c
    ));
  }

  if (contents?.parts) {
    return { ...contents, parts: await resolveParts(contents.parts) };
  }

  return contents;
}
