import { MemoryManagerView } from "./MemoryManagerView";

export default function MemorySettingsPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
      <h1 className="text-2xl font-semibold">Agent Memory</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Things the agent has remembered about you across chats. Delete
        anything inaccurate — the agent won&rsquo;t use deleted memories again.
      </p>
      <div className="mt-6">
        <MemoryManagerView />
      </div>
    </div>
  );
}
