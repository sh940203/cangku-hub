"use client";

import { Button } from "@/components/ui/button";

export function PrintButton({ disabled }: { disabled?: boolean }) {
  return (
    <Button variant="primary" disabled={disabled} onClick={() => window.print()}>
      列印標籤
    </Button>
  );
}
