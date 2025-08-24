import User from "../models/user.model.js";
import generateToken from "../utils/token.js";

export const register = async (req, res) => {
    try {
        const { fullName: { firstName, lastName }, email, password } = req.body;
        
        const checkUser = await User.findOne({ email });
        if (checkUser) {
            return res.status(400).json({ error: "User already exists" });
        }
        const user = await User.create({ fullName: { firstName, lastName }, email, password });
        const token = generateToken(user._id, user.email);

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000
        });

        res.status(201).json({ message: "User registered successfully" , fullName: { firstName, lastName }, email });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

export const login = async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const isMatch = await user.comparePassword(password);
        if (!isMatch) {
            return res.status(401).json({ error: "Invalid password" });
        }

        const { firstName, lastName } = user.fullName;

        const token = generateToken(user._id, user.email);

        res.cookie("token", token, {
            httpOnly: true,
            secure: true,
            sameSite: "strict",
            maxAge: 24 * 60 * 60 * 1000
        });

        res.status(200).json({ message: "User logged in successfully" , fullName: { firstName, lastName }, email });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
