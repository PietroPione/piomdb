import { NextResponse } from "next/server";
import { getPersonWithCredits } from "@/lib/tmdb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id") || "";

  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }

  try {
    const person = await getPersonWithCredits(id);
    if (!person) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(person);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Internal Server Error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
