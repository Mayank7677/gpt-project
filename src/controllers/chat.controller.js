import Chat from "../models/chat.model.js";

export const createChat = async (req, res) => {
  try {
    const { title } = req.body;
    const user = req.user;

    const newChat = await Chat.create({
      user: user._id,
      title,
    });
    res.status(201).json({ message: "Chat created successfully", newChat });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
