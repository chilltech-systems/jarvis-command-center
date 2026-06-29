import { NextResponse } from "next/server";
import { getAvaGmailAttention } from "@/lib/ava/gmail-attention";

export async function GET() {
  return NextResponse.json(await getAvaGmailAttention());
}
