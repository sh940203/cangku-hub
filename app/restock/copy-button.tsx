"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState<"idle" | "ok" | "fail">("idle");
  return (
    <div className="space-y-2">
      <Button
        variant="primary"
        className="w-full lg:w-auto"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setCopied("ok");
          } catch {
            setCopied("fail");
          }
        }}
      >
        複製叫貨清單
      </Button>
      {copied === "ok" && (
        <p role="status" className="text-ok">
          已複製，可以貼到 LINE 給老闆。
        </p>
      )}
      {copied === "fail" && (
        <p role="alert" className="text-error">
          這個瀏覽器不能自動複製，請長按下面的文字複製。
        </p>
      )}
    </div>
  );
}
