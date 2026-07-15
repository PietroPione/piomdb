import { NextResponse } from "next/server";
import { getSeasonEpisodes } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  const season = searchParams.get("season");

  if (!id || !season) {
    return NextResponse.json({ error: "Missing id or season parameter" }, { status: 400 });
  }

  try {
    const episodes = await getSeasonEpisodes(id, Number(season));
    return NextResponse.json({ season: Number(season), episodes });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
