/** Fetches a whole file, reporting progress (0–100) when the server sends its length. */
export async function fetchAudio(
  url: string,
  init: RequestInit,
  onProgress: (percent: number) => void,
): Promise<Blob> {
  const response = await fetch(url, init);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status} (${response.statusText})`);
  const total = Number(response.headers.get("Content-Length"));
  if (!response.body || !(total > 0)) return response.blob();

  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    received += value.byteLength;
    // A compressed response counts decoded bytes against the compressed length.
    onProgress(Math.min(100, Math.round((received / total) * 100)));
  }
  return new Blob(chunks, { type: response.headers.get("Content-Type") ?? "" });
}
