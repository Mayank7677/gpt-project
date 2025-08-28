// Import the Pinecone library
import { Pinecone } from "@pinecone-database/pinecone";

// Initialize a Pinecone client with your API key
const pc = new Pinecone({ apiKey: process.env.PINECONE_API_KEY });

// Create a dense index with integrated embedding
const gptProjectIndex = pc.Index("gpt-project");

// create ( storing ) memory in the pinecone DB
async function createMemory({ vectors, metadata, messageId }) {
  await gptProjectIndex.upsert([
    {
      id: messageId,
      values: vectors,
      metadata,
    },
  ]);
}

// query ( fetching ) memory from the pinecone DB for ltm
async function queryMemory({ queryVector, limit = 5, metadata }) {
  const data = await gptProjectIndex.query({
    vector: queryVector,
    topK: limit,
    filter: metadata ? metadata : undefined,
    includeMetadata: true,
  });

  return data.matches;
}

export { createMemory, queryMemory };
