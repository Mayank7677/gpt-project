// Import the Pinecone library
import { Pinecone } from "@pinecone-database/pinecone";

// Initialize a Pinecone client with your API key
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Create a dense index with integrated embedding
const gptProjectIndex = pc.Index("gpt-project");

async function createMemory({ vectors, metadata, messageId }) {

    
}

async function queryMemory({ queryVector, limit = 5, metadata }) {
  const data = await gptProjectIndex.query({
    vector: queryVector,
    topK: limit,
    filter: metadata ? { metadata } : undefined,
    includeMetadata: true,
  });

  return data.matches;
}
