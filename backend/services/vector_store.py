import os
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_chroma import Chroma
from langchain_core.documents import Document
from typing import List

CHROMA_PERSIST_DIR = "chroma_db"
os.makedirs(CHROMA_PERSIST_DIR, exist_ok=True)

class VectorStoreService:
    def __init__(self):
        # Using a fast, local, open-source embedding model
        self.embeddings = HuggingFaceEmbeddings(model_name="BAAI/bge-small-en-v1.5")
        
        self.vector_store = Chroma(
            collection_name="askmydocs_collection",
            embedding_function=self.embeddings,
            persist_directory=CHROMA_PERSIST_DIR
        )

    def add_documents(self, documents: List[Document], filename: str, user_id: str):
        # Ensure metadata has the filename, user_id, and any available page numbers
        for idx, doc in enumerate(documents):
            if "source" not in doc.metadata:
                doc.metadata["source"] = filename
            
            doc.metadata["filename"] = filename
            doc.metadata["chunk_index"] = idx
            doc.metadata["user_id"] = user_id  # Inject user ID for security boundary
            
        self.vector_store.add_documents(documents)

vector_store_service = VectorStoreService()
