// Shape of /api/snapshot. Shared by the server builder and the client search.

export type SnapshotSku = {
  id: number;
  code: string;
  barcode: string | null;
  productName: string;
  variantName: string | null;
  isBundle: boolean;
  /** Archived SKUs are kept so bundles built from them still compute, but are not searchable. */
  active: boolean;
  /** Physical stock; null for bundles. */
  stock: number | null;
  safetyStock: number | null;
  locationCode: string | null;
  /** Bundle parts; empty for physical SKUs. */
  components: { skuId: number; qty: number }[];
};

export type Snapshot = {
  generatedAt: number; // unix ms
  skus: SnapshotSku[];
};
