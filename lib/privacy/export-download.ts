export function exportDownloadHeaders(
  exportId: string,
  contentType: string | null,
) {
  return {
    "Cache-Control": "private, no-store",
    "Content-Disposition": `attachment; filename="kinavela-data-export-${exportId}.json"`,
    "Content-Type": contentType ?? "application/json",
  };
}
