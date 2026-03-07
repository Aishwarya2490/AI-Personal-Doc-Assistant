from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from services.document_processor import document_processor
from services.vector_store import vector_store_service
from core.security import get_current_user

router = APIRouter(
    prefix="/upload",
    tags=["Upload"]
)

ALLOWED_EXTENSIONS = {"pdf", "docx", "xlsx", "pptx", "txt"}
MAX_FILE_SIZE = 10 * 1024 * 1024 # 10MB limit

@router.post("/")
async def upload_document(
    file: UploadFile = File(...), 
    current_user: dict = Depends(get_current_user)
):
    if not file.filename:
        raise HTTPException(status_code=400, detail="No file uploaded")
    
    if file.size and file.size > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 10MB.")
        
    ext = file.filename.split(".")[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=400, detail=f"File extension {ext} not allowed.")
    
    try:
        # Save file
        file_path = await document_processor.save_uploaded_file(file)
        
        # Process and chunk file
        chunks = document_processor.extract_and_chunk(file_path)
        
        # Add chunks to Vector Store (ChromaDB)
        vector_store_service.add_documents(chunks, file.filename, current_user["user_id"])
        
        return {
            "message": "File processed and embedded successfully",
            "filename": file.filename,
            "num_chunks": len(chunks),
            "chunk_preview": [c.page_content[:100] for c in chunks[:2]] # preview first 2 chunks
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

