// PNG export of a DOM node (share cards / stats image), with the legacy
// copy → native share → download fallback chain.

/** Rasterize a node at `pixelRatio`, on the page background colour. */
export async function renderPng(node: HTMLElement, pixelRatio: number): Promise<Blob> {
  const { toBlob } = await import("html-to-image");
  const bg = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim() || "#0d0f0e";
  const blob = await toBlob(node, { pixelRatio, backgroundColor: bg, cacheBust: true });
  if (!blob) throw new Error("render failed");
  return blob;
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/**
 * Copy the image to the clipboard; if that is unavailable, open the native
 * share sheet (mobile); failing that, download it. Returns a status message.
 */
export async function copyImage(render: () => Promise<Blob>, fileName: string, title: string): Promise<string> {
  try {
    if (!navigator.clipboard || !window.ClipboardItem) throw new Error("no clipboard api");
    // A promise-valued item keeps the user gesture alive while rendering.
    await navigator.clipboard.write([new ClipboardItem({ "image/png": render() })]);
    return "Copied to clipboard ✓";
  } catch {
    // fall through to share / download
  }
  try {
    const blob = await render();
    const file = new File([blob], fileName, { type: "image/png" });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title });
      return "Shared ✓ — copy or save it from there.";
    }
    downloadBlob(blob, fileName);
    return "Saved to your device ✓";
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") return "";
    return "Could not copy here — use Download instead.";
  }
}

export async function downloadImage(render: () => Promise<Blob>, fileName: string): Promise<string> {
  try {
    downloadBlob(await render(), fileName);
    return "Downloaded ✓";
  } catch {
    return "Something went wrong.";
  }
}
