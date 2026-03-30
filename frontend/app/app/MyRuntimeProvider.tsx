"use client";

import { AuiProvider, ChatModelAdapter, ExportedMessageRepository, RemoteThreadListAdapter, RuntimeAdapterProvider, Suggestions, ThreadHistoryAdapter, ThreadMessageLike, useAui, useCloudThreadListAdapter, useCloudThreadListRuntime, useLocalRuntime, useRemoteThreadListRuntime } from "@assistant-ui/react";
import { AppendMessage } from "@assistant-ui/react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { FC, PropsWithChildren, useCallback, useMemo, useState } from "react";
import { createAssistantStream } from "assistant-stream";


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
  status: "regular"
})


const useLocalHistoryAdapter=  ()=>{
    const aui = useAui();
  const [adapter] = useState(
    () => {
      return {
        load: async ()=>{
          console.log('load', aui, aui.threadListItem().getState())
          const threadId =aui.threadListItem().getState()
          if(threadId.remoteId == null){
            return ExportedMessageRepository.fromArray([])
          }
          return ExportedMessageRepository.fromArray([{
                role: "user",
                content: "hello from " + aui.threadListItem().getState().remoteId,
            }])
        },
        append: async (message)=>{
          console.log('append', message)
        }
      } as ThreadHistoryAdapter
      }
  );
  return adapter;
}
const useLocalThreadAdapter = () :RemoteThreadListAdapter=>{
  return {
  async list() {
    return {
      threads: Array.from(threadsStore.values()).map((thread) => ({
        remoteId: thread.remoteId,
        status: thread.status,
        title: thread.title,
      })),
    };
  },

  async initialize(localId) {
    console.log('init', localId)
    const remoteId = localId;
    threadsStore.set(remoteId, {
      remoteId,
      status: "regular",
    });
    return { remoteId, externalId: undefined };
  },

  async rename(remoteId, title) {
    const thread = threadsStore.get(remoteId);
    if (thread) {
      thread.title = title;
    }
  },

  async archive(remoteId) {
    const thread = threadsStore.get(remoteId);
    if (thread) {
      thread.status = "archived";
    }
  },

  async unarchive(remoteId) {
    const thread = threadsStore.get(remoteId);
    if (thread) {
      thread.status = "regular";
    }
  },

  async delete(remoteId) {
    threadsStore.delete(remoteId);
  },

  async fetch(remoteId) {
    console.log('fetch', remoteId)
    const thread = threadsStore.get(remoteId);
    if (!thread) {
      throw new Error("Thread not found");
    }
    return {
      remoteId: thread.remoteId,
      status: thread.status,
      title: thread.title,
    };
  },

  async generateTitle(_remoteId, messages) {
    // Generate a simple title from the first user message
    console.log("generateTitle", messages)
    return createAssistantStream(async (controller) => {
      const firstUserMessage = messages.find((m) => m.role === "user");
      if (firstUserMessage) {
        const content = firstUserMessage.content
          .filter((c) => c.type === "text")
          .map((c) => c.text)
          .join(" ");
        const title = content.slice(0, 50) + (content.length > 50 ? "..." : "");
        controller.appendText(title);
      } else {
        controller.appendText("New Chat");
      }
    });
  },
  unstable_Provider: useCallback<FC<PropsWithChildren>>(
    function Provider({ children }) {
      const history = useLocalHistoryAdapter()

      const adapters = useMemo(
        () => ({
          history
        }),
        [history],
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


const useLocalModelAdapter = ()=>{
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
        session_id: "123",
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

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {


  const runtime = useRemoteThreadListRuntime({
    runtimeHook: ()=> useLocalRuntime(useLocalModelAdapter()),
     adapter: useLocalThreadAdapter()     
  })

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
