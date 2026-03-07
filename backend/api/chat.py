from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from fastapi.responses import StreamingResponse
from services.chat_service import chat_service
from core.security import get_current_user

router = APIRouter(
    prefix="/chat",
    tags=["Chat"]
)

class ChatRequest(BaseModel):
    question: str

@router.post("/")
async def chat_endpoint(request: ChatRequest, current_user: dict = Depends(get_current_user)):
    if not request.question or not request.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty")
    
    return StreamingResponse(
        chat_service.stream_chat(request.question, current_user["user_id"]),
        media_type="text/event-stream"
    )

