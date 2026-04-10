"use client";

import { useMutation } from "@tanstack/react-query";
import { Loader2, Search as SearchIcon, Sparkles } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { searchImages } from "@/lib/api";
import { resolveMediaUrl } from "@/lib/media";
import { getStatusBadgeClass } from "@/lib/utils";

export default function SearchPage() {
  const [query, setQuery] = useState("");

  const searchMutation = useMutation({
    mutationFn: (searchQuery: string) =>
      searchImages({ query: searchQuery, limit: 24 }),
  });

  const handleSearch = (event: React.FormEvent) => {
    event.preventDefault();
    if (query.trim()) {
      searchMutation.mutate(query.trim());
    }
  };

  return (
    <div className="min-h-screen bg-white">
      <div className="mx-auto max-w-4xl px-6 py-20">
        <div className="mb-12 text-center">
          <h1 className="mb-4 text-5xl font-medium tracking-tight text-black">
            Find anything.
          </h1>
          <p className="text-gray-500 text-base">
            Search your memories using natural language.
          </p>
        </div>

        <form onSubmit={handleSearch} className="mb-16 max-w-2xl mx-auto">
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <SearchIcon className="h-5 w-5 text-gray-400 group-focus-within:text-black transition-colors" />
            </div>
            <input
              type="text"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="e.g. A sunset over the mountains..."
              className="block w-full pl-12 pr-6 py-5 border-none bg-gray-50 hover:bg-gray-100 focus:bg-white focus:ring-2 focus:ring-black rounded-2xl text-lg transition-all outline-none"
            />
            {query && (
              <button
                type="submit"
                className="absolute inset-y-2 right-2 px-4 bg-black text-white text-sm font-medium rounded-xl hover:bg-gray-800 transition-colors"
              >
                Search
              </button>
            )}
          </div>

          <div className="mt-6 flex flex-wrap justify-center gap-2">
            <span className="text-xs text-gray-400 py-1">Try:</span>
            {[
              "sunset over mountains",
              "people smiling",
              "documents with text",
              "street photography at night",
            ].map((example) => (
              <button
                key={example}
                type="button"
                onClick={() => {
                  setQuery(example);
                  searchMutation.mutate(example);
                }}
                className="px-3 py-1 rounded-full bg-gray-50 text-xs text-gray-500 hover:bg-gray-100 hover:text-black transition-colors"
              >
                {example}
              </button>
            ))}
          </div>
        </form>

        {searchMutation.isPending && (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
          </div>
        )}

        {searchMutation.isError && (
          <div className="py-32 text-center">
            <p className="text-gray-400">Search failed. Please try again.</p>
          </div>
        )}

        {!searchMutation.data && !searchMutation.isPending && (
          <div className="py-32 text-center">
            <Sparkles className="mx-auto mb-4 h-16 w-16 text-gray-200" />
            <p className="mb-2 text-gray-400">Start searching</p>
            <p className="text-sm text-gray-300">
              Use natural language to search your indexed image library.
            </p>
          </div>
        )}

        {searchMutation.data && searchMutation.data.results.length === 0 && (
          <div className="py-32 text-center">
            <p className="mb-2 text-gray-400">No results found</p>
            <p className="text-sm text-gray-300">
              Try a broader phrase or mention a visible object, setting, or
              mood.
            </p>
          </div>
        )}

        {searchMutation.data && searchMutation.data.results.length > 0 && (
          <div>
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-gray-400">
                Found {searchMutation.data.results.length} result
                {searchMutation.data.results.length !== 1 ? "s" : ""} for "
                {searchMutation.data.query}"
              </p>
              <p className="text-xs text-gray-400">
                Similarity is based on the combined visual and text embedding.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
              {searchMutation.data.results.map((result) => {
                const imageSrc =
                  resolveMediaUrl(
                    result.metadata.url,
                    result.metadata.minio_key,
                  ) ??
                  "data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

                return (
                  <div
                    key={result.media_id}
                    className="group relative aspect-square overflow-hidden rounded-sm border border-gray-100 bg-gray-50 transition-all hover:border-gray-300"
                  >
                    <Image
                      src={imageSrc}
                      alt={result.metadata.filename}
                      fill
                      className="object-cover"
                      sizes="(max-width: 768px) 50vw, (max-width: 1200px) 33vw, 16vw"
                      unoptimized
                    />

                    <div className="absolute right-2 top-2 rounded-sm bg-white/90 px-2 py-1 backdrop-blur-sm">
                      <span className="text-xs font-medium text-black">
                        {Math.round(result.similarity * 100)}%
                      </span>
                    </div>

                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100">
                      <div className="absolute bottom-0 left-0 right-0 space-y-1 p-3">
                        <p className="truncate text-xs font-medium text-white">
                          {result.metadata.filename}
                        </p>
                        {result.metadata.caption && (
                          <p className="text-xs text-white/80">
                            {result.metadata.caption}
                          </p>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className={getStatusBadgeClass(
                              result.metadata.status,
                            )}
                          >
                            {result.metadata.status}
                          </span>
                          {typeof result.metadata.cluster_id === "number" && (
                            <span className="text-[10px] uppercase tracking-wide text-white/75">
                              Cluster {result.metadata.cluster_id}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
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
