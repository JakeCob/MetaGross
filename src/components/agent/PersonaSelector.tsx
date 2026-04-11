"use client";

import { AGENT_PERSONAS, type AgentPersona } from "@/lib/types/agent";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface PersonaSelectorProps {
  value: AgentPersona;
  onChange: (persona: AgentPersona) => void;
}

export function PersonaSelector({ value, onChange }: PersonaSelectorProps) {
  return (
    <Select
      value={value}
      onValueChange={(val) => onChange(val as AgentPersona)}
    >
      <SelectTrigger className="w-full">
        <SelectValue placeholder="Select persona" />
      </SelectTrigger>
      <SelectContent>
        {(Object.keys(AGENT_PERSONAS) as AgentPersona[]).map((key) => {
          const persona = AGENT_PERSONAS[key];
          return (
            <SelectItem key={key} value={key}>
              <div className="flex flex-col gap-0.5">
                <span className="font-medium">{persona.displayName}</span>
                <span className="text-xs text-muted-foreground">
                  {persona.description}
                </span>
              </div>
            </SelectItem>
          );
        })}
      </SelectContent>
    </Select>
  );
}
