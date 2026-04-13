"use client";

import { Thread } from "@/components/assistant-ui/thread";
import { ThreadList } from "@/components/assistant-ui/thread-list";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useAui, AuiProvider, Suggestions } from "@assistant-ui/react";

function ThreadWithSuggestions() {
  const aui = useAui({
    suggestions: Suggestions([
      {
        title: "Send a test message",
        label: "to see the external store in action",
        prompt: "Hello! How does the external store work?",
      },
      {
        title: "Tell me a story",
        label: "to generate multiple messages",
        prompt: "Tell me a short story about a robot learning to paint.",
      },
      
    ])
  });
  return (
    <AuiProvider value={aui}>
      <TooltipProvider>
      <Thread />
      </TooltipProvider>
    </AuiProvider>
  );
}

export default function Home() {
  return (
    <main className="grid h-dvh grid-cols-[200px_1fr] grid-rows-[minmax(0,1fr)] gap-4 p-4">
      <ThreadList />
      <ThreadWithSuggestions />
    </main>
  );
}
