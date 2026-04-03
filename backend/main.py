import json
import logging
from typing import Optional

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import dspy
import os

from pydantic import BaseModel

from tools.web_search import search_web
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

chat_model = dspy.ReAct(ChatWithHistory, tools=[get_courses,get_people_in_courses, search_web])

class ChatRequest(BaseModel):
    internal_id: str
    session_id: Optional[str] = ""
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
    id: str
    message_text: list[dict]


class ThreadRequest(BaseModel):
    id: str


class ThreadResponse(BaseModel):
    id: str
    externalId: str
    remoteId: str
    status: str
    title: str

thread_db = {} # similate a database

@app.post("/thread", response_model=ThreadResponse)
def create_thread(req: ThreadRequest)->ThreadResponse:
    thread_db[id] = {
        "id":req.id,
        "status": "regular",
        "remoteId": req.id,
        "externalId":req.id,
        "title": "New Chat"
    }
    
    return thread_db[id]

@app.get("/thread", response_model=list[ThreadResponse])
def get_threads()->list[ThreadResponse]:    
    return thread_db.values()

@app.get("/thread/{thread_id}", response_model=ThreadResponse)
def get_threads(thread_id: str)->ThreadResponse:    
    return thread_db[thread_id]


@app.delete("/thread/{thread_id}", response_model=list[ThreadResponse])
def get_threads(thread_id: str)->list[ThreadResponse]:    
    thread = thread_db.pop(thread_id)
    return thread

@app.post("/generate-title", response_model=TitleResponse)
def generate_title(req: TitleRequest)-> TitleResponse:
    
    title_summerizer = dspy.Predict(ThreadTitleSignature)
    result = title_summerizer(message=req.message_text)
    thread_db[id]["title"]= result.get("title")
    return TitleResponse(title=result.get("title"))

@app.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    # Initialize session
    if req.session_id not in chat_store:
        chat_store[req.session_id] = []

    history = chat_store[req.session_id] # save/load this from the db

    # Format history for DSPy
    history_text = format_history(history)

    # Call model
    result = await chat_model.aforward(
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
