from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import dspy
import os

from pydantic import BaseModel
load_dotenv()

dspy.configure(
    lm=dspy.LM(
        os.getenv("MODEL_NAME"), 
        api_key=os.getenv("OPEN_API_KEY"), 
        api_base=os.getenv("OPEN_API_URL")
    )
)

app = FastAPI()
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
chat_store = {}

#add_pydantic_ai_route(app, agent, "/api/chat")
class ChatWithHistory(dspy.Signature):
    history = dspy.InputField(desc="Conversation so far")
    question = dspy.InputField()
    answer = dspy.OutputField()


chat_model = dspy.ChainOfThought(ChatWithHistory)
class ChatRequest(BaseModel):
    session_id: str
    messages: list[dict]
    metadata: Optional[dict] = {}
    tools: Optional[dict] = {}
    trigger: Optional[str] = ""

class ChatResponse(BaseModel):
    content: str
    role: str

def format_history(messages: list[dict]) -> str:
    return "\n".join(
        [f"{m['role']}: {m['content']}" for m in messages]
    )


@app.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest):
    # Initialize session
    if req.session_id not in chat_store:
        chat_store[req.session_id] = []

    history = chat_store[req.session_id]

    # Format history for DSPy
    history_text = format_history(history)

    # Call model
    result = chat_model(
        history=history_text,
        question=req.messages[-1]
    )

    # Save new messages
    history.append(req.messages[-1])
    history.append({"role": "assistant", "content": result.answer})

    return {"role": "assistant", "content": result.answer}

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
