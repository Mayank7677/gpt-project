import dotenv from "dotenv";
dotenv.config();

import express from "express";
import cookieParser from "cookie-parser";

import userRoutes from "./routes/user.route.js";
import chatRoutes from "./routes/chat.route.js";

const app = express();

// middleware
app.use(express.json());
app.use(cookieParser());

// routes
app.use('/api/users', userRoutes);
app.use('/api/chats', chatRoutes);

export default app;
