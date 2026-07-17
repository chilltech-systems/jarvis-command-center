import type { Metadata } from "next";
import { AvaMindCanvas } from "@/components/ava-mind/AvaMindCanvas";

export const metadata: Metadata = {
  title: "AVA Mobile Preview",
  description: "Local mobile preview for AVA's cognitive field visualization.",
};

export default function AvaMobilePreviewPage() {
  return <AvaMindCanvas />;
}
