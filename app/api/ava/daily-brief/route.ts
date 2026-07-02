import { NextResponse } from "next/server";
import { getAvaExecutiveContext } from "@/lib/ava/core";

export async function GET() {
  const executiveContext = await getAvaExecutiveContext();

  return NextResponse.json(executiveContext.dailyBrief);
}
