import { Server } from "socket.io";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import { generateResponse, generateEmbedding } from "../services/ai.service.js";
import Message from "../models/message.model.js";
import { createMemory, queryMemory } from "../services/vector.service.js";

function initSocketServer(httpServer) {
  const io = new Server(httpServer);

  io.use(async (socket, next) => {
    const cookies = cookie.parse(socket.request.headers.cookie || "");

    if (!cookies.token) {
      return next(new Error("Authentication required : Token not found"));
    }

    try {
      const decode = jwt.verify(cookies.token, process.env.JWT_SECRET);

      const user = await User.findById(decode.id);
      if (!user) {
        return next(new Error("Authentication failed : Invalid token"));
      }

      socket.user = user;

      next();
    } catch (error) {
      return next(new Error("Authentication failed : Invalid token"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("disconnect", () => {
      console.log("User disconnected");
    });

    socket.on("ai-message", async (msgPayload) => {
      console.log("User Message : ", msgPayload);

      // storing user question in the mongoDB
      const userMessage = await Message.create({
        user: socket.user._id,
        chat: msgPayload.chat,
        content: msgPayload.content,
        role: "user",
      });

      // Embedding : converting user's message into vectors
      const embedding = await generateEmbedding(msgPayload.content);

      // creating long term memory by sending the current's user's message embedding to the pinecone DB
      const memory = await queryMemory({
        queryVector: embedding,
        limit: 5,
        metadata: {},
      });

      // creating long term memory
      const ltm = [
        {
          role: "system",
          parts: [
            {
              text: `
          these are some previous conversation , use it to answer the user query
          ${memory.map((item) => item.metadata.text).join("\n")}`,
            },
          ],
        },
      ];

      console.log("Memory : ", memory);

      // storing user's message embedding in the pinecone DB
      await createMemory({
        vectors: embedding,
        metadata: {
          chatId: msgPayload.chat,
          userId: socket.user._id,
          text: msgPayload.content,
        },
        messageId: userMessage._id,
      });

      // creating short term memory by fetching the last 3 messages from the mongoDB
      const chatHistory = (
        await Message.find({ chat: msgPayload.chat })
          .sort({ createdAt: -1 })
          .limit(3)
          .lean()
      ).reverse();

      // creating short term memory
      const stm = chatHistory.map((item) => {
        return {
          role: item.role,
          parts: [{ text: item.content }],
        };
      });

      // generating response using long term memory and short term memory
      const response = await generateResponse([...ltm, ...stm]);

      // storing AI's response in the mongoDB
      const responseMessage = await Message.create({
        user: socket.user._id,
        chat: msgPayload.chat,
        content: response,
        role: "model",
      });

      console.log("Response Message : ", responseMessage);

      // genrating AI's response embedding
      const responseEmbedding = await generateEmbedding(response);

      // storing AI's response embedding in the pinecone DB
      await createMemory({
        vectors: responseEmbedding,
        metadata: {
          chatId: msgPayload.chat,
          userId: socket.user._id,
          text: response,
        },
        messageId: responseMessage._id,
      });

      // emitting AI's response to the client
      socket.emit("ai-response", {
        content: response,
        chat: msgPayload.chat,
      });
    });
  });
}

export default initSocketServer;
