from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from api import upload, chat, auth

app = FastAPI(
    title="AskMyDocs API",
    description="Backend API for the AskMyDocs document intelligence assistant.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(upload.router)
app.include_router(chat.router)

@app.get("/")
async def root():
    return {"message": "Welcome to AskMyDocs API"}


