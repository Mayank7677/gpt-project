import { Server } from "socket.io";
import cookie from "cookie";
import jwt from "jsonwebtoken";
import User from "../models/user.model.js";
import generateResponse from "../services/ai.service.js";
import Message from "../models/message.model.js";

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

      await Message.create({
        user: socket.user._id,
        chat: msgPayload.chat,
        content: msgPayload.content,
        role: "user",
      });

      const chatHistory = (
        await Message.find({ chat: msgPayload.chat })
          .sort({ createdAt: -1 })
          .limit(5)
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

      console.log("AI Response : ", response);

      await Message.create({
        user: socket.user._id,
        chat: msgPayload.chat,
        content: response,
        role: "model",
      });

      socket.emit("ai-response", {
        content: response,
        chat: msgPayload.chat,
      });
    });
  });
}

export default initSocketServer;
