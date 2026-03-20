import json
from typing import AsyncGenerator
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
from services.vector_store import vector_store_service

class ChatService:
    def __init__(self):
        # We assume GOOGLE_API_KEY is available in the environment implicitly
        # (Loaded via python-dotenv in production, or set in the shell)
        self.llm = ChatGoogleGenerativeAI(model="gemini-1.5-flash", temperature=0, streaming=True)
        # Store vector store instance directly for dynamic filtering
        self.vector_store = vector_store_service.vector_store
        
        # Construct a precise system prompt
        self.system_prompt = (
            "You are AskMyDocs, a helpful and intelligent AI document assistant.\n"
            "Answer the user's question using ONLY the provided context below.\n"
            "If the answer is not contained within the context, politely state that you don't know and do not hallucinate.\n\n"
            "Context:\n{context}"
        )
        
        self.prompt = ChatPromptTemplate.from_messages([
            ("system", self.system_prompt),
            ("human", "{question}")
        ])
    
    def format_docs_for_context(self, docs):
        # Format the retrieved documents to inject into the LLM context
        return "\n\n".join(
            f"Source: {doc.metadata.get('filename', 'Unknown')} (Chunk {doc.metadata.get('chunk_index', '?')})\n"
            f"Content: {doc.page_content}"
            for doc in docs
        )

    async def stream_chat(self, question: str, user_id: str) -> AsyncGenerator[str, None]:
        # 1. Retrieval Mechanism with Multi-Tenant Data Isolation
        # Fetch relevant chunks from ChromaDB filtering by the specific user_id
        docs = await self.vector_store.asimilarity_search(question, k=4, filter={"user_id": user_id})
        context_str = self.format_docs_for_context(docs)
        
        # Prepare sources to send back to the frontend for UI citations
        sources = [
            {
                "filename": doc.metadata.get("filename", "Unknown"),
                "chunk_index": doc.metadata.get("chunk_index", "Unknown"),
                "content_preview": doc.page_content[:150] + "..."
            }
            for doc in docs
        ]

        # 2. Prompt Engineering & Chain setup
        chain = self.prompt | self.llm | StrOutputParser()
        
        # 3. Streaming Response via Server-Sent Events (SSE)
        # Stream the LLM tokens
        async for chunk in chain.astream({"context": context_str, "question": question}):
            # Ensure the chunk is a string
            content = str(chunk)
            if content:
                yield f"data: {json.dumps({'type': 'token', 'content': content})}\n\n"
        
        # Stream the citation sources after generation is complete
        yield f"data: {json.dumps({'type': 'sources', 'content': sources})}\n\n"
        
        # Signal stream end
        yield "data: [DONE]\n\n"

chat_service = ChatService()
