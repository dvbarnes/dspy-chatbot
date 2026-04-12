"use client";

import { AuiProvider, ChatModelAdapter, ChatModelRunResult, ExportedMessageRepository, FeedbackAdapter, RemoteThreadListAdapter, RuntimeAdapterProvider, Suggestions, ThreadAssistantMessagePart, ThreadHistoryAdapter, ThreadMessageLike, useAui, useCloudThreadListAdapter, useCloudThreadListRuntime, useLocalRuntime, useRemoteThreadListRuntime } from "@assistant-ui/react";
import { AppendMessage } from "@assistant-ui/react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { FC, PropsWithChildren, useCallback, useMemo, useState } from "react";
import { createAssistantStream } from "assistant-stream";
import { useDataStreamRuntime } from "@assistant-ui/react-data-stream";


const threadsStore = new Map<
  string,
  {
    remoteId: string;
    status: "regular" | "archived";
    title?: string;
  }
>();

threadsStore.set("__LOCALID_y0WREqa", {
  remoteId: "__LOCALID_y0WREqa",
  status: "regular",
  title: "existing chat"
})


const useLocalHistoryAdapter = () => {
  const aui = useAui();
  const [adapter] = useState(
    () => {
      return {
        load: async () => {
          console.log('load', aui, aui.threadListItem().getState())
          const threadId = aui.threadListItem().getState()
          if (threadId.remoteId == null) {
            return ExportedMessageRepository.fromArray([])
          }
          return ExportedMessageRepository.fromArray([{
            role: "user",
            content: "hello from " + aui.threadListItem().getState().remoteId,
          }])
        },
        append: async (message) => {
          console.log('append', message)
        }
      } as ThreadHistoryAdapter
    }
  );
  return adapter;
}
const useFeedbackAdapter = ()=>{
  const aui = useAui();
  const [adapter] = useState(
    () => {
      return {
        submit(feedback) {
          console.log("feedback", feedback)
        },
      } as FeedbackAdapter
    }
  );
  return adapter;
}
const useLocalThreadAdapter = (): RemoteThreadListAdapter => {
  return {
    async list() {

        const result = await fetch("http://localhost:8000/thread", {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        });
        const data = await result.json();
        console.log("list", data)
      return {
        threads: data,
      };
    },

    async initialize(localId) {
      console.log('init', localId)
      const remoteId = localId;
      threadsStore.set(remoteId, {
        remoteId,
        status: "regular",
      });
        const result = await fetch("http://localhost:8000/thread", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: localId
            ,
          }),
        });
        const data = await result.json();
      return { remoteId: data.externalId, externalId: data.externalId };
    },

    async rename(remoteId, title) {
      const thread = threadsStore.get(remoteId);
      if (thread) {
        thread.title = title;
      }
    },

    async archive(remoteId) {
      console.log("delete thread", remoteId)
       const result = await fetch(`http://localhost:8000/thread/${remoteId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          }
        });
        const data = await result.json();
        return data
    },

    async unarchive(remoteId) {
      const thread = threadsStore.get(remoteId);
      if (thread) {
        thread.status = "regular";
      }
    },

    async delete(remoteId) {
      console.log("delete thread", remoteId)
       const result = await fetch(`http://localhost:8000/thread/${remoteId}`, {
          method: "DELETE",
          headers: {
            "Content-Type": "application/json",
          }
        });
        const data = await result.json();
        return data
    },

    async fetch(remoteId) {
       const result = await fetch(`http://localhost:8000/thread/${remoteId}`, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          }
        });
        const data = await result.json();
        return data
    },

    async generateTitle(_remoteId, messages) {
      // Generate a simple title from the first user message
      console.log("generateTitle", messages)
      return createAssistantStream(async (controller) => {

        const firstUserMessage = messages.find((m) => m.role === "user");
        const result = await fetch("http://localhost:8000/generate-title", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            id: _remoteId,
            message_text: firstUserMessage?.content
            ,
          }),
        });
        const data = await result.json();
        controller.appendText(data.title)
      })
    },
    unstable_Provider: useCallback<FC<PropsWithChildren>>(
      function Provider({ children }) {
        const history = useLocalHistoryAdapter()
        const feedback = useFeedbackAdapter()
        const adapters = useMemo(
          () => ({
            history,
            feedback
          }),
          [history, feedback],
        );

        return (
          <RuntimeAdapterProvider adapters={adapters}>
            {children}
          </RuntimeAdapterProvider>
        );
      },
      []
    )
  }
};


const useLocalModelAdapter = () => {
  const aui = useAui();
  const [adapter] = useState(
    () => {

      const MyModelAdapter: ChatModelAdapter = {

        async run({ messages, abortSignal, context, runConfig }) {
          console.log('run', messages, abortSignal, context, runConfig, aui, aui.threadListItem().getState())
          // TODO replace with your own API

          const result = await fetch("http://localhost:8000/chat", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              internal_id: aui.threadListItem().getState().id,
              session_id:aui.threadListItem().getState().externalId,
              messages,
            }),
            signal: abortSignal,
          });
          const data = await result.json();
          return data;
        },
      };
      return MyModelAdapter
    },
  );
  return adapter;
}


const useLocalStreamingAdapter = () => {
  const aui = useAui();
  const [adapter] = useState(
    () => {

      const MyModelAdapter: ChatModelAdapter = {

        async *run({ messages, abortSignal, context, runConfig }) {
          console.log('run', messages, abortSignal, context, runConfig, aui, aui.threadListItem().getState())
          // TODO replace with your own API

          const response = await fetch("http://localhost:8000/chat-stream", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              internal_id: aui.threadListItem().getState().id,
              session_id:aui.threadListItem().getState().externalId,
              messages,
            }),
            signal: abortSignal,
          });
         const reader = response.body!.getReader();
    const decoder = new TextDecoder();

    let buffer = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        if (!part.startsWith("data:")) continue;

        const data = part.replace("data: ", "").trim();

        if (data === "[DONE]") return;
        console.log("data", JSON.parse(data));
        yield {
          content: [{
            type: "text-delta" as any,
            text: JSON.parse(data).textDelta ?? "hello",
            
          } as any,
        ]
        } as ChatModelRunResult;
      }
    }
        },
      };
      return MyModelAdapter
    },
  );
  return adapter;
}

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {


  const runtime = useRemoteThreadListRuntime({
    runtimeHook: () => useDataStreamRuntime({
      api: 'http://localhost:8000/chat-stream',
    }),
    adapter: useLocalThreadAdapter()
  })

  //   const runtime = useRemoteThreadListRuntime({
  //   runtimeHook: () => useLocalRuntime(useLocalModelAdapter()),
  //   adapter: useLocalThreadAdapter()
  // })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
