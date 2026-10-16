import type { Metadata } from "next";
import { Suspense } from "react";
import { Heart } from "@/components/heart";
import { id } from "@/i18n/id";
import { BoothRoom } from "./booth-room";

export const metadata: Metadata = { title: `Booth ${id.appName}` };

function Loading() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-6">
      <Heart className="size-12" pulse />
      <p className="font-display text-xl">{id.booth.loading}</p>
    </main>
  );
}

// Kode booth hanya diketahui saat request, jadi seluruh ruang booth dirender di klien.
export default function BoothPage() {
  return (
    <Suspense fallback={<Loading />}>
      <BoothRoom />
    </Suspense>
  );
}
