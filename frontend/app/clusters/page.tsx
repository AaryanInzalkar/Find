"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Grid3x3, Loader2, Play, RefreshCw, Sparkles, X } from "lucide-react";
import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  getClusterDetail,
  getClusters,
  getJobStatus,
  triggerClustering,
} from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";

function formatJobStatus(status?: string) {
  switch (status) {
    case "queued":
      return "Queued";
    case "started":
      return "Running";
    case "finished":
      return "Finished";
    case "failed":
      return "Failed";
    default:
      return "Idle";
  }
}

export default function ClustersPage() {
  const queryClient = useQueryClient();
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(
    null,
  );
  const [clusterJobId, setClusterJobId] = useState<string | null>(null);

  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["clusters"],
    queryFn: getClusters,
    refetchInterval: clusterJobId ? 4000 : 10000,
  });

  const selectedClusterQuery = useQuery({
    queryKey: ["cluster-detail", selectedClusterId],
    queryFn: () => getClusterDetail(selectedClusterId as number),
    enabled: selectedClusterId !== null,
  });

  const clusterJobQuery = useQuery({
    queryKey: ["cluster-job", clusterJobId],
    queryFn: () => getJobStatus(clusterJobId as string),
    enabled: clusterJobId !== null,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "finished" || status === "failed" ? false : 2500;
    },
  });

  useEffect(() => {
    if (!clusterJobId || !clusterJobQuery.data) {
      return;
    }

    if (clusterJobQuery.data.status === "finished") {
      toast.success("Clustering finished. The page has been refreshed.");
      queryClient.invalidateQueries({ queryKey: ["clusters"] });
      setClusterJobId(null);
    }

    if (clusterJobQuery.data.status === "failed") {
      toast.error("Clustering failed. Check the worker logs for details.");
      setClusterJobId(null);
    }
  }, [clusterJobId, clusterJobQuery.data, queryClient]);

  const clusterMutation = useMutation({
    mutationFn: triggerClustering,
    onSuccess: (result) => {
      setClusterJobId(result.job_id);
      toast.success(
        result.enqueued
          ? "Clustering job queued"
          : "Clustering is already queued or running",
      );
    },
    onError: () => {
      toast.error("Failed to start clustering");
    },
  });

  const totals = useMemo(() => {
    const totalImages = data?.clusters.reduce(
      (sum, cluster) => sum + cluster.member_count,
      0,
    );

    return {
      totalClusters: data?.total ?? 0,
      totalImages: totalImages ?? 0,
    };
  }, [data]);

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="mb-12 flex flex-col md:flex-row items-end justify-between border-b border-gray-100 pb-8 gap-6">
          <div className="max-w-2xl">
            <h1 className="mb-4 text-4xl font-medium tracking-tight text-black">
              Clusters
            </h1>
            <p className="text-sm text-gray-500 leading-relaxed">
              Find automatically groups similar images together to help you
              organize your collection. The AI dynamically identifies patterns
              and contexts.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() =>
                queryClient.invalidateQueries({ queryKey: ["clusters"] })
              }
              className="inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-black"
            >
              <RefreshCw
                className={`h-4 w-4 ${isFetching ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => clusterMutation.mutate()}
              disabled={clusterMutation.isPending || clusterJobQuery.isFetching}
              className="inline-flex items-center gap-2 rounded-full bg-black px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {clusterMutation.isPending || clusterJobQuery.isFetching ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" />
              )}
              Re-cluster
            </button>
          </div>
        </div>

        {clusterJobQuery.data?.status && (
          <div className="mb-12 flex justify-center">
            <div className="inline-flex items-center gap-3 rounded-full bg-gray-50 px-6 py-3">
              <Sparkles className="h-4 w-4 text-black" />
              <span className="text-sm font-medium text-black">
                Job status: {formatJobStatus(clusterJobQuery.data?.status)}
              </span>
              {clusterJobQuery.data?.job_id && (
                <span className="text-xs text-gray-400">
                  ID: {clusterJobQuery.data.job_id.slice(0, 8)}
                </span>
              )}
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center justify-center py-32">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        )}

        {error && (
          <div className="py-32 text-center">
            <p className="text-gray-400">Failed to load clusters</p>
          </div>
        )}

        {data && data.clusters.length === 0 && (
          <div className="py-32 text-center">
            <Grid3x3 className="mx-auto mb-4 h-16 w-16 text-gray-200" />
            <p className="mb-2 text-gray-400">No clusters found yet</p>
            <p className="mb-6 text-sm text-gray-300">
              Upload and index several related images, then wait for automatic
              clustering or trigger it manually here.
            </p>
            <button
              type="button"
              onClick={() => clusterMutation.mutate()}
              disabled={clusterMutation.isPending}
              className="text-sm text-black underline transition-colors hover:text-gray-600"
            >
              Run clustering now
            </button>
          </div>
        )}

        {data && data.clusters.length > 0 && (
          <>
            <div className="mb-10 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-sm border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Total clusters
                </p>
                <p className="mt-2 text-2xl font-light text-black">
                  {totals.totalClusters}
                </p>
              </div>
              <div className="rounded-sm border border-gray-100 p-4">
                <p className="text-xs uppercase tracking-wide text-gray-400">
                  Clustered images
                </p>
                <p className="mt-2 text-2xl font-light text-black">
                  {totals.totalImages}
                </p>
              </div>
            </div>

            <div className="space-y-8">
              {data.clusters.map((cluster) => (
                <div
                  key={cluster.id}
                  className="rounded-sm border border-gray-100 p-6"
                >
                  <div className="mb-4 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="mb-2 flex items-center gap-3">
                        <h2 className="text-lg font-medium text-black">
                          Cluster {cluster.id}
                        </h2>
                        <span className="rounded-sm bg-gray-100 px-2 py-1 text-xs font-medium text-gray-600">
                          {cluster.member_count}{" "}
                          {cluster.member_count === 1 ? "image" : "images"}
                        </span>
                      </div>
                      {cluster.label && (
                        <p className="text-sm text-gray-500">{cluster.label}</p>
                      )}
                      {cluster.description && (
                        <p className="mt-1 text-sm text-gray-400">
                          {cluster.description}
                        </p>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => setSelectedClusterId(cluster.id)}
                      className="rounded-sm border border-black px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-black hover:text-white"
                    >
                      View members
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-8">
                    {cluster.samples.map((sample) => {
                      const imageSrc = resolveMediaUrl(sample.url);

                      return (
                        <div
                          key={sample.id}
                          className="group aspect-square overflow-hidden rounded-sm border border-gray-100 bg-gray-50"
                        >
                          {imageSrc ? (
                            <Image
                              src={imageSrc}
                              alt={sample.filename}
                              width={240}
                              height={240}
                              className="h-full w-full object-cover transition-transform group-hover:scale-105"
                              unoptimized
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                              No preview
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {selectedClusterId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4">
          <div className="relative max-h-[90vh] w-full max-w-6xl overflow-hidden rounded-sm bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => setSelectedClusterId(null)}
              className="absolute right-4 top-4 z-20 rounded-full bg-black/70 p-2 text-white transition hover:bg-black"
              aria-label="Close cluster detail"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="border-b border-gray-100 px-6 py-5">
              <h2 className="text-xl font-medium text-black">
                Cluster {selectedClusterId}
              </h2>
              <p className="text-sm text-gray-500">
                Browse the images grouped together by the semantic clustering
                job.
              </p>
            </div>

            <div className="max-h-[calc(90vh-88px)] overflow-y-auto p-6">
              {selectedClusterQuery.isLoading && (
                <div className="flex items-center justify-center py-24">
                  <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
                </div>
              )}

              {selectedClusterQuery.isError && (
                <div className="py-16 text-center text-gray-400">
                  Failed to load cluster details.
                </div>
              )}

              {selectedClusterQuery.data && (
                <div>
                  <div className="mb-6 flex flex-wrap items-center gap-4 text-sm text-gray-500">
                    <span>
                      {selectedClusterQuery.data.member_count} members
                    </span>
                    {selectedClusterQuery.data.label && (
                      <span>{selectedClusterQuery.data.label}</span>
                    )}
                    {selectedClusterQuery.data.description && (
                      <span>{selectedClusterQuery.data.description}</span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    {selectedClusterQuery.data.members.map((member) => {
                      const imageSrc = resolveMediaUrl(member.url);

                      return (
                        <div
                          key={member.id}
                          className="overflow-hidden rounded-sm border border-gray-100 bg-white"
                        >
                          <div className="relative aspect-[4/3] bg-gray-50">
                            {imageSrc ? (
                              <Image
                                src={imageSrc}
                                alt={member.filename}
                                fill
                                className="object-cover"
                                sizes="(max-width: 768px) 100vw, 33vw"
                                unoptimized
                              />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-sm text-gray-400">
                                No preview
                              </div>
                            )}
                          </div>
                          <div className="space-y-2 p-4">
                            <p className="text-sm font-medium text-black">
                              {member.filename}
                            </p>
                            {member.caption && (
                              <p className="text-sm text-gray-500">
                                {member.caption}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
