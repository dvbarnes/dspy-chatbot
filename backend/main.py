import json
import logging
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


class Evidence(BaseModel):
    toolName: str
    output: str
    
class ChatWithHistory(dspy.Signature):
    history = dspy.InputField(desc="Conversation so far")
    question = dspy.InputField()
    answer = dspy.OutputField()


def get_courses():
    return [
        {
            "name": "course_1"
        },
        {
            "name": "course_2"
        }
    ]
def get_people_in_courses():
    return [
        {
            "name": "course_1"
        },
        {
            "name": "course_2"
        }
    ]

class ThreadTitleSignature(dspy.Signature):
    """
    You are a helpful assistant provided with a list of messages and expected to return a summary of this message to be used as the title in a thread
    for a chat bot. Please limit your response to 50 characters.
    """
    message: list[dict] = dspy.InputField()
    title: str = dspy.OutputField()

chat_model = dspy.ReAct(ChatWithHistory, tools=[get_courses,get_people_in_courses])

class ChatRequest(BaseModel):
    session_id: str
    messages: list[dict]
    tools: list[Evidence] = [] 
    metadata: Optional[dict] = {}
    trigger: Optional[str] = ""

class ChatResponse(BaseModel):
    content: list[dict] | str
    role: str

def format_history(messages: list[dict]) -> str:
    return "\n".join(
        [f"{m['role']}: {m['content']}" for m in messages]
    )


class TitleResponse(BaseModel):
    title: str


class TitleRequest(BaseModel):
    message_text: list[dict]


@app.post("/generate-title", response_model=TitleResponse)
def generate_title(req: TitleRequest)-> TitleResponse:
    title_summerizer = dspy.Predict(ThreadTitleSignature)
    result = title_summerizer(message=req.message_text)
    return TitleResponse(title=result.get("title"))

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
    logging.error(result)
    history.append(req.messages[-1])
    history.append({"role": "assistant", "content": result.answer})
    tools =[
            {"type": "tool-call", 
            "toolName":  value,
            "result": result.trajectory["observation_" + key.replace("tool_name_", "")]
            }  for (key,value) in result.trajectory.items() if key.startswith("tool_name") and value != 'finish' ]
    c =[
            {"type": "text", 
            "text": result.answer},
            *tools
            
    ]
    logging.error(c)
    return {
        "role": "assistant", 
        "content": c
        }

if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
