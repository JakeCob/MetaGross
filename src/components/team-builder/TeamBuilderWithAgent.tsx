"use client";

import { useState } from "react";
import { TeamBuilder } from "./TeamBuilder";
import { AgentPanel } from "@/components/agent";
import { Button } from "@/components/ui/button";

interface TeamBuilderWithAgentProps {
  teamId?: string;
}

export function TeamBuilderWithAgent({ teamId }: TeamBuilderWithAgentProps) {
  const [agentOpen, setAgentOpen] = useState(false);

  return (
    <>
      {/* Desktop: side-by-side layout */}
      <div className="hidden lg:grid lg:grid-cols-[2fr_1fr] lg:gap-6">
        <TeamBuilder teamId={teamId} />
        <div className="sticky top-4 h-[calc(100vh-6rem)]">
          <AgentPanel
            contextType="team"
            contextId={teamId}
          />
        </div>
      </div>

      {/* Mobile/tablet: stacked with collapsible agent */}
      <div className="lg:hidden">
        <TeamBuilder teamId={teamId} />

        {/* Mobile toggle button */}
        <div className="fixed bottom-4 right-4 z-40">
          <Button
            size="icon-lg"
            className="h-12 w-12 rounded-full shadow-lg"
            onClick={() => setAgentOpen((o) => !o)}
            aria-label={agentOpen ? "Close AI assistant" : "Open AI assistant"}
          >
            {agentOpen ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M12 2v4" />
                <path d="m16 6-2.6 2.6" />
                <path d="M20 12h-4" />
                <path d="m16 18-2.6-2.6" />
                <path d="M12 18v4" />
                <path d="m8 18 2.6-2.6" />
                <path d="M4 12h4" />
                <path d="m8 6 2.6 2.6" />
                <circle cx="12" cy="12" r="2" />
              </svg>
            )}
          </Button>
        </div>

        {/* Mobile agent drawer */}
        {agentOpen && (
          <div className="fixed inset-x-0 bottom-0 z-30 h-[60vh] bg-background border-t border-border shadow-2xl animate-in slide-in-from-bottom duration-300">
            <div className="h-full p-3">
              <AgentPanel
                contextType="team"
                contextId={teamId}
              />
            </div>
          </div>
        )}
      </div>
    </>
  );
}
