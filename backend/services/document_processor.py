import os
import shutil
from fastapi import UploadFile
from langchain_community.document_loaders import UnstructuredFileLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class DocumentProcessor:
    def __init__(self):
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=1000,
            chunk_overlap=200,
            length_function=len,
            is_separator_regex=False,
        )

    async def save_uploaded_file(self, file: UploadFile) -> str:
        file_path = os.path.join(UPLOAD_DIR, file.filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        return file_path

    def extract_and_chunk(self, file_path: str):
        # Using unstructured to parse the document
        loader = UnstructuredFileLoader(file_path)
        documents = loader.load()
        
        # Chunking strategy
        chunks = self.text_splitter.split_documents(documents)
        return chunks

document_processor = DocumentProcessor()
