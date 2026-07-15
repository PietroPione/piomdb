import { NextResponse } from "next/server";
import { resolveShowByTitle } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = searchParams.get("title");
  const type = (searchParams.get("type") as "movie" | "tv") || "tv";

  if (!title) {
    return NextResponse.json({ error: "Missing title parameter" }, { status: 400 });
  }

  const result = await resolveShowByTitle(title, type);
  return NextResponse.json(result);
}
