import type { MOVEMENT_REASONS } from "@/db/schema";

// Words used in the warehouse (design.md §9).
export const MOVEMENT_REASON_LABEL: Record<(typeof MOVEMENT_REASONS)[number], string> = {
  order: "訂單出貨",
  cancel: "取消加回",
  restock: "進貨",
  return: "退貨",
  damage: "損壞",
  owner_take: "老闆取用",
  adjust: "盤點調整",
  initial: "初始",
};
