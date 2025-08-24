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
      console.log("AI Message : ", msgPayload);

      const userMessage = await Message.create({
        user: socket.user._id,
        chat: msgPayload.chat,
        content: msgPayload.content,
        role: "user",
      });

      const embedding = await generateEmbedding(msgPayload.content);

      const memory = await queryMemory({
        queryVector: embedding,
        limit: 5,
        metadata: {},
      });

      console.log("Memory : ", memory);

      await createMemory({
        vectors: embedding,
        metadata: {
          chatId: msgPayload.chat,
          userId: socket.user._id,
          text: msgPayload.content,
        },
        messageId: userMessage._id,
      });

      const chatHistory = (
        await Message.find({ chat: msgPayload.chat })
          .sort({ createdAt: -1 })
          .limit(3)
          .lean()
      ).reverse();

      const response = await generateResponse(
        chatHistory.map((item) => {
          return {
            role: item.role,
            parts: [{ text: item.content }],
          };
        })
      );

      const responseMessage = await Message.create({
        user: socket.user._id,
        chat: msgPayload.chat,
        content: response,
        role: "model",
      });

      console.log("Response Message : ", responseMessage);

      const responseEmbedding = await generateEmbedding(response);

      await createMemory({
        vectors: responseEmbedding,
        metadata: {
          chatId: msgPayload.chat,
          userId: socket.user._id,
          text: response,
        },
        messageId: responseMessage._id,
      });

      socket.emit("ai-response", {
        content: response,
        chat: msgPayload.chat,
      });
    });
  });
}

export default initSocketServer;
