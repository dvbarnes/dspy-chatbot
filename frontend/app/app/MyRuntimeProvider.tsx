"use client";

import { ThreadMessageLike } from "@assistant-ui/react";
import { AppendMessage } from "@assistant-ui/react";
import {
  AssistantRuntimeProvider,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import { useState } from "react";
import { metadata } from "./layout";

const convertMessage = (message: ThreadMessageLike) => {
  return message;
};


/*
class ChatRequest(BaseModel):
    session_id: str
    messages: list[dict]
    metadata: Optional[dict] = {}
    tools: Optional[dict] = {}
    trigger: Optional[str] = ""
*/
const sendMessage = async (data: any) :Promise<ThreadMessageLike>=>{

      const response = await fetch("http://localhost:8000/chat", {
      method: 'POST', // Specify the method
      headers: {
        'Content-Type': 'application/json' // Declare the body type
      },
      body: JSON.stringify({
        session_id: '123',
        messages: [data],
        metadata: {}
      }) 
    });
    return response.json();
}

export function MyRuntimeProvider({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const [messages, setMessages] = useState<readonly ThreadMessageLike[]>([]);

  const onNew = async (message: AppendMessage) => {
    if (message.content.length !== 1 || message.content[0]?.type !== "text")
      throw new Error("Only text content is supported");

    const userMessage: ThreadMessageLike = {
      role: "user",
      content: [{ type: "text", text: message.content[0].text }],
    };
    setMessages((currentMessages) => [...currentMessages, userMessage]);

    // normally you would perform an API call here to get the assistant response
    const assistantMessage = await sendMessage(userMessage)

    // const assistantMessage: ThreadMessageLike = {
    //   role: "assistant",
    //   content: [{ type: "text", text: "Hello, world!" }],
    // };
    setMessages((currentMessages) => [...currentMessages, assistantMessage]);
  };

  const runtime = useExternalStoreRuntime<ThreadMessageLike>({
    messages,
    setMessages,
    onNew,
    convertMessage,
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      {children}
    </AssistantRuntimeProvider>
  );
}
