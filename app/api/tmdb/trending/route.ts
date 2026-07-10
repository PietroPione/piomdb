import { NextResponse } from "next/server";
import { getTrendingMedia } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "all") as "movie" | "tv" | "all";

  try {
    const results = await getTrendingMedia(type);
    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
