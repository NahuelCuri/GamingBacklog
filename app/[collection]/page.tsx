import { notFound } from "next/navigation";
import { CollectionPage } from "@/components/collection/CollectionPage";
import { COLLECTION_KEYS, isCollectionKey } from "@/config/collections";
import { LIBRARIES } from "@/config/libraries";

// Static export: one page per collection (/games/, /books/, …).
export const dynamicParams = false;

export function generateStaticParams() {
  return COLLECTION_KEYS.map((collection) => ({ collection }));
}

export async function generateMetadata({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  const label = LIBRARIES.find((l) => l.key === collection)?.label;
  return { title: label ? `${label} · Backlog` : "Backlog" };
}

export default async function Page({ params }: { params: Promise<{ collection: string }> }) {
  const { collection } = await params;
  if (!isCollectionKey(collection)) notFound();
  return <CollectionPage collection={collection} />;
}
