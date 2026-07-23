import { NextResponse } from "next/server";
import { getGenreList } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const type = (searchParams.get("type") || "movie") as "movie" | "tv";

  try {
    const genres = await getGenreList(type);
    return NextResponse.json({ genres });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
