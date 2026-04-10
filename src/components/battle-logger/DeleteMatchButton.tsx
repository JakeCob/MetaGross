"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";

export interface DeleteMatchButtonProps {
  matchId: string;
}

export function DeleteMatchButton({ matchId }: DeleteMatchButtonProps) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);

  const handleDelete = useCallback(async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete this match? This cannot be undone.",
    );
    if (!confirmed) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/matches/${matchId}`, {
        method: "DELETE",
      });
      if (!res.ok && res.status !== 204) {
        throw new Error("Failed to delete match");
      }
      router.push("/battles");
    } catch (err) {
      setDeleting(false);
      alert(err instanceof Error ? err.message : "Failed to delete match");
    }
  }, [matchId, router]);

  return (
    <Button
      variant="destructive"
      size="sm"
      onClick={handleDelete}
      disabled={deleting}
    >
      {deleting ? "Deleting..." : "Delete"}
    </Button>
  );
}
