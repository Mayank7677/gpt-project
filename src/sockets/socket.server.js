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

      /* 
      storing user question in the mongoDB and 
      converting user's message into vectors
      */
      const [userMessage, embedding] = await Promise.all([
        Message.create({
          user: socket.user._id,
          chat: msgPayload.chat,
          content: msgPayload.content,
          role: "user",
        }),

        generateEmbedding(msgPayload.content),
      ]);

      /*
      creating long term memory by sending the current's user's message embedding to the pinecone DB
      creating short term memory by fetching the last 3 messages from the mongoDB
      storing user's message embedding in the pinecone DB
      */
      const [memory, chatHistory, createdMemory] = await Promise.all([
        queryMemory({
          queryVector: embedding,
          limit: 5,
          metadata: {
            userId: socket.user._id, // filtering memory of current user
          },
        }),

        Message.find({ chat: msgPayload.chat })
          .sort({ createdAt: -1 })
          .limit(3)
          .lean(),

        createMemory({
          vectors: embedding,
          metadata: {
            chatId: msgPayload.chat,
            userId: socket.user._id,
            text: msgPayload.content,
          },
          messageId: userMessage._id,
        }),
      ]);

      console.log('memory : ', memory)

      /*
      creating long term memory
      creating short term memory
      */
      const [ltm, stm] = await Promise.all([
        [
          {
            role: "user",
            parts: [
              {
                text: `
          these are some previous conversation , use it to answer the user query
          ${memory.map((item) => item.metadata.text).join("\n")}`,
              },
            ],
          },
        ],

        chatHistory.reverse().map((item) => {
          return {
            role: item.role,
            parts: [{ text: item.content }],
          };
        }),
      ]);

      console.log('ltm : ', ltm)
      console.log('----------------------------------')
      console.log('stm : ', stm)

      // generating response using long term memory and short term memory
      const response = await generateResponse([...ltm, ...stm]);

      console.log("AI Response : ", response);

      // emitting AI's response to the client
      socket.emit("ai-response", {
        content: response,
        chat: msgPayload.chat,
      });

      /*
      storing AI's response in the mongoDB
      genrating AI's response embedding
      */
      const [responseMessage, responseEmbedding] = await Promise.all([
        Message.create({
          user: socket.user._id,
          chat: msgPayload.chat,
          content: response,
          role: "model",
        }),

        generateEmbedding(response),
      ]);

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
    });
  });
}

export default initSocketServer;
