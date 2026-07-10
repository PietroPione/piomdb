import { NextResponse } from "next/server";
import { searchMedia } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get("query") || "";
  const type = (searchParams.get("type") || "all") as "movie" | "tv" | "all";

  try {
    const results = await searchMedia(query, type);
    return NextResponse.json({ results });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
