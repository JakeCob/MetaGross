"use client";

import { useState } from "react";
import type { WriteActionProposal } from "@/lib/types/agent";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckIcon, XIcon, PencilIcon } from "lucide-react";

interface AgentApprovalCardProps {
  proposal: WriteActionProposal;
  onApprove: () => void;
  onReject: () => void;
  onEdit: (editedPayload: unknown) => void;
}

const ACTION_LABELS: Record<string, string> = {
  update_match_notes: "Update Match Notes",
  update_team_notes: "Update Team Notes",
  create_team_variant: "Create Team Variant",
  patch_team_pokemon: "Patch Team Pokemon",
};

export function AgentApprovalCard({
  proposal,
  onApprove,
  onReject,
  onEdit,
}: AgentApprovalCardProps) {
  const [editing, setEditing] = useState(false);
  const [editedPayload, setEditedPayload] = useState(
    JSON.stringify(proposal.payload, null, 2)
  );
  const [parseError, setParseError] = useState<string | null>(null);

  const handleEditSubmit = () => {
    try {
      const parsed = JSON.parse(editedPayload);
      setParseError(null);
      setEditing(false);
      onEdit(parsed);
    } catch {
      setParseError("Invalid JSON");
    }
  };

  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-sm">
          <Badge variant="warning">
            {ACTION_LABELS[proposal.actionType] ?? proposal.actionType}
          </Badge>
          <span className="text-xs text-muted-foreground">Approval Required</span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-foreground">{proposal.description}</p>

        {editing ? (
          <div className="space-y-2">
            <textarea
              value={editedPayload}
              onChange={(e) => setEditedPayload(e.target.value)}
              className="w-full min-h-[120px] rounded-lg border border-input bg-transparent px-3 py-2 text-xs font-mono outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
            />
            {parseError && (
              <p className="text-xs text-destructive">{parseError}</p>
            )}
            <div className="flex gap-2">
              <Button size="sm" onClick={handleEditSubmit}>
                Submit Edit
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setEditing(false);
                  setParseError(null);
                  setEditedPayload(JSON.stringify(proposal.payload, null, 2));
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <pre className="rounded-md bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all text-foreground/80">
            {JSON.stringify(proposal.payload, null, 2)}
          </pre>
        )}
      </CardContent>
      {!editing && (
        <CardFooter className="gap-2">
          <Button size="sm" onClick={onApprove} className="bg-green-600 hover:bg-green-700 text-white">
            <CheckIcon className="size-3.5" />
            Approve
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
            <PencilIcon className="size-3.5" />
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={onReject}>
            <XIcon className="size-3.5" />
            Reject
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
