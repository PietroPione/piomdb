import { NextResponse } from "next/server";
import { discoverMedia, DiscoverOptions, MediaItem } from "@/lib/tmdb";
import { interleaveMedia } from "@/lib/mediaMerge";

function parseIds(value: string | null): number[] | undefined {
  if (!value) return undefined;
  const ids = value.split(",").map((v) => parseInt(v, 10)).filter((n) => !isNaN(n));
  return ids.length ? ids : undefined;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "all") as "movie" | "tv" | "all";

  const options: DiscoverOptions = {
    genreIds: parseIds(searchParams.get("genres")),
    keywordIds: parseIds(searchParams.get("keywords")),
    castIds: parseIds(searchParams.get("cast")),
    crewIds: parseIds(searchParams.get("crew")),
    sortBy: searchParams.get("sortBy") || undefined,
    minVoteAverage: searchParams.get("minVoteAverage") ? Number(searchParams.get("minVoteAverage")) : undefined,
    page: searchParams.get("page") ? Number(searchParams.get("page")) : undefined,
  };

  try {
    let results: MediaItem[];
    let totalResults: number;
    if (type === "all") {
      // Genre ids mean different things per media type (TV has no "Science Fiction"
      // genre, movies have no "Sci-Fi & Fantasy"), so genre filters are only ever
      // sent by the client when a specific type is selected. Each list already comes
      // sorted per the requested sortBy; interleaving keeps both types visible instead
      // of letting movies (higher vote counts) crowd out shows.
      const [movies, shows] = await Promise.all([
        discoverMedia("movie", options),
        discoverMedia("tv", options),
      ]);
      results = interleaveMedia(movies.results, shows.results);
      totalResults = movies.totalResults + shows.totalResults;
    } else {
      const discovered = await discoverMedia(type, options);
      results = discovered.results;
      totalResults = discovered.totalResults;
    }
    return NextResponse.json({ results, totalResults });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
