import type { Metadata } from "next";
import { AvaMindCanvas } from "@/components/ava-mind/AvaMindCanvas";

export const metadata: Metadata = {
  title: "AVA Cognitive Core",
  description: "A real-time holographic visualization of AVA's active digital mind.",
};

export default function MindOfAvaPage() {
  return <AvaMindCanvas />;
}
