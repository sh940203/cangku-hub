import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { adapters } from "@/lib/platforms";
import { ListingImportForm } from "./listing-import-form";

export default function ListingImportPage() {
  const platforms = Object.values(adapters)
    .filter((a) => a.listings)
    .map((a) => ({ id: a.id, label: a.label, howToGet: a.listings!.howToGet }));
  return (
    <>
      <Link href="/products" className="text-aux text-action hover:underline">
        ‹ 商品
      </Link>
      <PageHeader title="從平台匯入商品" />
      <ListingImportForm platforms={platforms} />
    </>
  );
}
