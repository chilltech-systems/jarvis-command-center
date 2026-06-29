import { NextResponse } from "next/server";
import { getAvaTasks } from "@/lib/ava/todoist";

export async function GET() {
  const data = await getAvaTasks();
  return NextResponse.json(data);
}
