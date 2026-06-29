import { NextResponse } from "next/server";
import { getAvaWeather } from "@/lib/ava/weather";

export async function GET() {
  return NextResponse.json(await getAvaWeather());
}
