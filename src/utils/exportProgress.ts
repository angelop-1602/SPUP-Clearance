import type { BulkExportProgress } from "@/services/exportService";

export function formatExportBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  return `${value.toFixed(value >= 10 || unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

export function getExportProgressPercent(progress: BulkExportProgress): number {
  if (progress.total <= 0) return 0;

  if (progress.stage === "selecting-folder" || progress.stage === "preparing") {
    return 0;
  }

  const completedBefore = Math.max(progress.current - 1, 0);
  let currentFraction = 0;

  if (progress.stage === "downloading") {
    currentFraction = 0.2;

    if (progress.bytesTotal && progress.bytesTotal > 0) {
      currentFraction =
        (Math.min(progress.bytesLoaded ?? 0, progress.bytesTotal) / progress.bytesTotal) * 0.6;
    }
  } else if (progress.stage === "extracting") {
    currentFraction = 0.7;
  } else if (progress.stage === "writing") {
    currentFraction = 0.8;

    if (progress.filesTotal && progress.filesTotal > 0) {
      currentFraction =
        0.8 +
        (Math.min(progress.filesWritten ?? 0, progress.filesTotal) /
          progress.filesTotal) *
          0.2;
    }
  } else if (
    progress.stage === "marking" ||
    progress.stage === "completed" ||
    progress.stage === "failed"
  ) {
    currentFraction = 1;
  }

  return Math.round(
    Math.min(100, ((completedBefore + currentFraction) / progress.total) * 100)
  );
}

export function getExportProgressDetail(progress: BulkExportProgress): string {
  const itemText =
    progress.current > 0
      ? `Submission ${Math.min(progress.current, progress.total)} of ${progress.total}`
      : `${progress.total} submissions ready`;

  if (progress.stage === "downloading" && typeof progress.bytesLoaded === "number") {
    if (progress.bytesTotal) {
      return `${itemText} - ${formatExportBytes(progress.bytesLoaded)} of ${formatExportBytes(progress.bytesTotal)} downloaded`;
    }

    return `${itemText} - ${formatExportBytes(progress.bytesLoaded)} downloaded`;
  }

  if (progress.stage === "writing" && progress.filesTotal) {
    return `${itemText} - ${progress.filesWritten ?? 0} of ${progress.filesTotal} files written`;
  }

  return itemText;
}
