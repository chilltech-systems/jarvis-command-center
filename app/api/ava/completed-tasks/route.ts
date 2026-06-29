import { NextResponse } from "next/server";
import { getAvaCompletedTasks } from "@/lib/ava/completed-tasks";

export async function GET() {
  return NextResponse.json(await getAvaCompletedTasks());
}
