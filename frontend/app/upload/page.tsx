"use client";

import { useMutation } from "@tanstack/react-query";
import {
  CheckCircle,
  Image as ImageIcon,
  Loader2,
  Package,
  Upload,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { toast } from "sonner";
import {
  getJobStatus,
  type JobStatus,
  type UploadResponse,
  type UploadResult,
  uploadImages,
  uploadImagesBulk,
} from "@/lib/api";

type UploadMode = "single" | "bulk";
type ProcessingState = "queued" | "processing" | "indexed" | "failed";

type UploadListItem = UploadResult & {
  jobStatus?: JobStatus["status"];
  processingState?: ProcessingState;
};

function hydrateResults(response: UploadResponse) {
  return response.results.map<UploadListItem>((result) => ({
    ...result,
    jobStatus: result.status === "uploaded" ? "queued" : undefined,
    processingState: result.status === "uploaded" ? "queued" : undefined,
  }));
}

function getProcessingState(jobStatus?: JobStatus["status"]): ProcessingState {
  if (jobStatus === "finished") {
    return "indexed";
  }
  if (jobStatus === "failed") {
    return "failed";
  }
  if (jobStatus === "started") {
    return "processing";
  }
  return "queued";
}

function getDisplayStatus(item: UploadListItem) {
  if (item.status === "duplicate") {
    return "duplicate";
  }
  if (item.status === "failed") {
    return "upload failed";
  }
  if (item.processingState === "indexed") {
    return "indexed";
  }
  if (item.processingState === "failed") {
    return "processing failed";
  }
  if (item.processingState === "processing") {
    return "processing";
  }
  return "queued";
}

function getStatusClasses(item: UploadListItem) {
  if (item.status === "duplicate") {
    return "bg-yellow-100 text-yellow-800";
  }
  if (item.status === "failed" || item.processingState === "failed") {
    return "bg-red-100 text-red-700";
  }
  if (item.processingState === "indexed") {
    return "bg-green-100 text-green-700";
  }
  if (item.processingState === "processing") {
    return "bg-blue-100 text-blue-700";
  }
  return "bg-gray-100 text-gray-700";
}

export default function UploadPage() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadListItem[]>([]);
  const [mode, setMode] = useState<UploadMode>("single");

  const parsedBulkLimit = Number(
    process.env.NEXT_PUBLIC_MAX_BULK_FILES ?? "200",
  );
  const maxBulkFiles =
    Number.isFinite(parsedBulkLimit) && parsedBulkLimit > 0
      ? Math.floor(parsedBulkLimit)
      : 200;

  const uploadMutation = useMutation({
    mutationFn: uploadImages,
    onSuccess: (data) => {
      setUploadedFiles((prev) => [...hydrateResults(data), ...prev]);
      toast.success(
        `Queued ${data.total} file${data.total === 1 ? "" : "s"} for analysis`,
      );
    },
    onError: () => {
      toast.error("Upload failed");
    },
  });

  const bulkUploadMutation = useMutation({
    mutationFn: uploadImagesBulk,
    onSuccess: (data) => {
      setUploadedFiles((prev) => [...hydrateResults(data), ...prev]);
      const uploadedCount = data.results.filter(
        (item) => item.status === "uploaded",
      ).length;
      toast.success(
        `Archive accepted (${uploadedCount} new upload${
          uploadedCount === 1 ? "" : "s"
        })`,
      );
    },
    onError: () => {
      toast.error("Bulk upload failed");
    },
  });

  const isUploading = uploadMutation.isPending || bulkUploadMutation.isPending;

  const activeJobs = useMemo(
    () =>
      uploadedFiles.filter(
        (item) =>
          item.job_id &&
          item.status === "uploaded" &&
          item.processingState !== "indexed" &&
          item.processingState !== "failed",
      ),
    [uploadedFiles],
  );

  useEffect(() => {
    if (activeJobs.length === 0) {
      return;
    }

    let cancelled = false;

    const pollJobs = async () => {
      const jobStatuses = await Promise.all(
        activeJobs.map(async (item) => {
          if (!item.job_id) {
            return null;
          }

          try {
            return await getJobStatus(item.job_id);
          } catch {
            return {
              job_id: item.job_id,
              status: "failed",
              error: "Could not reach the job status endpoint.",
            } as JobStatus;
          }
        }),
      );

      if (cancelled) {
        return;
      }

      setUploadedFiles((current) =>
        current.map((item) => {
          if (!item.job_id) {
            return item;
          }

          const job = jobStatuses.find(
            (entry) => entry?.job_id === item.job_id,
          );
          if (!job) {
            return item;
          }

          const processingState = getProcessingState(job.status);
          return {
            ...item,
            jobStatus: job.status,
            processingState,
            error:
              processingState === "failed"
                ? (job.error ?? item.error)
                : item.error,
          };
        }),
      );
    };

    void pollJobs();
    const intervalId = window.setInterval(() => {
      void pollJobs();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [activeJobs]);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        toast.error("No valid images selected");
        return;
      }

      const fileList = Object.assign(acceptedFiles, {
        item: (index: number) => acceptedFiles[index] || null,
      }) as unknown as FileList;

      uploadMutation.mutate(fileList);
    },
    [uploadMutation],
  );

  const onBulkDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length === 0) {
        toast.error("No archive selected");
        return;
      }

      const [archive] = acceptedFiles;
      if (!archive) {
        toast.error("No archive selected");
        return;
      }

      bulkUploadMutation.mutate(archive);
    },
    [bulkUploadMutation],
  );

  const {
    getRootProps: getSingleRootProps,
    getInputProps: getSingleInputProps,
    isDragActive: isSingleDragActive,
    fileRejections: singleRejections,
  } = useDropzone({
    onDrop,
    accept: {
      "image/jpeg": [".jpg", ".jpeg"],
      "image/png": [".png"],
      "image/webp": [".webp"],
      "image/gif": [".gif"],
    },
    maxSize: 50 * 1024 * 1024,
    multiple: true,
    disabled: mode !== "single" || isUploading,
  });

  const {
    getRootProps: getBulkRootProps,
    getInputProps: getBulkInputProps,
    isDragActive: isBulkDragActive,
    fileRejections: bulkRejections,
  } = useDropzone({
    onDrop: onBulkDrop,
    accept: {
      "application/zip": [".zip"],
      "application/x-zip-compressed": [".zip"],
    },
    maxFiles: 1,
    multiple: false,
    disabled: mode !== "bulk" || isUploading,
  });

  const activeRootProps =
    mode === "single" ? getSingleRootProps : getBulkRootProps;
  const activeInputProps =
    mode === "single" ? getSingleInputProps : getBulkInputProps;
  const isDragActive =
    mode === "single" ? isSingleDragActive : isBulkDragActive;
  const fileRejections = mode === "single" ? singleRejections : bulkRejections;

  const helperText = useMemo(() => {
    if (mode === "single") {
      return "JPEG, PNG, WebP, GIF • Max 50MB each";
    }

    return `Upload a ZIP archive up to ${maxBulkFiles} images`;
  }, [mode, maxBulkFiles]);

  const stats = useMemo(
    () => ({
      queued: uploadedFiles.filter((item) => item.processingState === "queued")
        .length,
      processing: uploadedFiles.filter(
        (item) => item.processingState === "processing",
      ).length,
      indexed: uploadedFiles.filter(
        (item) => item.processingState === "indexed",
      ).length,
      failed: uploadedFiles.filter(
        (item) => item.status === "failed" || item.processingState === "failed",
      ).length,
      duplicates: uploadedFiles.filter((item) => item.status === "duplicate")
        .length,
    }),
    [uploadedFiles],
  );

  const showActions = stats.indexed > 0 || stats.duplicates > 0;

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-3xl px-6 py-12">
        <div className="mb-12 text-center">
          <h1 className="mb-3 text-4xl font-medium tracking-tight text-black">
            Upload
          </h1>
          <p className="text-sm text-gray-500">
            Add images to analyze. Semantic search and clustering run locally in
            the background.
          </p>
        </div>

        <div className="mb-6 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              mode === "single"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-500 hover:text-black hover:bg-gray-200"
            }`}
          >
            Files
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`px-6 py-2 rounded-full text-sm font-medium transition-colors ${
              mode === "bulk"
                ? "bg-black text-white"
                : "bg-gray-100 text-gray-500 hover:text-black hover:bg-gray-200"
            }`}
          >
            ZIP Archive
          </button>
        </div>

        <div
          {...activeRootProps()}
          className={`rounded-2xl p-16 text-center cursor-pointer transition-all ${
            isDragActive
              ? "bg-gray-100 scale-[1.02]"
              : "bg-gray-50 hover:bg-gray-100"
          } ${isUploading ? "pointer-events-none opacity-50" : ""}`}
        >
          <input {...activeInputProps()} />
          {mode === "single" ? (
            <Upload className="mx-auto mb-4 h-8 w-8 text-gray-400" />
          ) : (
            <Package className="mx-auto mb-4 h-8 w-8 text-gray-400" />
          )}

          {isDragActive ? (
            <p className="text-base font-medium text-black">Drop to upload</p>
          ) : (
            <>
              <p className="mb-1 text-base font-medium text-black">
                {mode === "single"
                  ? "Drop images here"
                  : "Drop a ZIP archive here"}
              </p>
              <p className="text-sm text-gray-500">{helperText}</p>
            </>
          )}
        </div>

        {fileRejections.length > 0 && (
          <div className="mt-6 rounded-xl bg-red-50 p-4">
            <p className="mb-2 text-sm font-medium text-red-900">
              Some files were rejected:
            </p>
            <ul className="space-y-1 text-sm text-red-700">
              {fileRejections.map(({ file, errors }) => (
                <li key={file.name}>
                  {file.name}: {errors[0]?.message}
                </li>
              ))}
            </ul>
          </div>
        )}

        {(isUploading || activeJobs.length > 0) && (
          <div className="mt-8 text-center text-gray-500">
            <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
            <p className="text-sm font-medium text-black">
              {isUploading
                ? "Uploading..."
                : `Analyzing ${activeJobs.length} image${activeJobs.length === 1 ? "" : "s"}...`}
            </p>
            <p className="text-xs text-gray-400 mt-1">Indexing updates live.</p>
          </div>
        )}

        {showActions && (
          <div className="mt-8 flex justify-center gap-4">
            <Link
              href="/gallery"
              className="rounded-full bg-black px-6 py-2.5 text-sm font-medium text-white transition-transform hover:scale-105"
            >
              Open gallery
            </Link>
            <Link
              href="/clusters"
              className="rounded-full border border-gray-200 px-6 py-2.5 text-sm font-medium text-black transition-colors hover:border-black hover:bg-gray-50"
            >
              View clusters
            </Link>
          </div>
        )}

        {uploadedFiles.length > 0 && (
          <div className="mt-12">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-medium text-black">Recent Uploads</h3>
              <span className="text-xs text-gray-500">
                {uploadedFiles.length} total
              </span>
            </div>
            <div className="space-y-2">
              {uploadedFiles.map((result, idx) => {
                const displayStatus = getDisplayStatus(result);

                return (
                  <div
                    key={`${result.filename}-${idx}`}
                    className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      {result.status === "duplicate" ? (
                        <ImageIcon className="h-4 w-4 text-yellow-500" />
                      ) : result.status === "failed" ||
                        result.processingState === "failed" ? (
                        <XCircle className="h-4 w-4 text-red-500" />
                      ) : result.processingState === "indexed" ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}

                      <p className="text-sm font-medium text-black truncate max-w-[200px] sm:max-w-xs">
                        {result.filename}
                      </p>
                    </div>

                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClasses(result)}`}
                    >
                      {displayStatus}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
