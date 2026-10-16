import type { Metadata } from "next";
import { Suspense } from "react";
import { Heart } from "@/components/heart";
import { id } from "@/i18n/id";
import { StripResult } from "./strip-result";

export const metadata: Metadata = { title: id.result.title };

export default function ResultPage() {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 flex-col items-center justify-center gap-4">
          <Heart className="size-12" pulse />
          <p className="font-display text-xl">{id.result.loading}</p>
        </main>
      }
    >
      <StripResult />
    </Suspense>
  );
}
