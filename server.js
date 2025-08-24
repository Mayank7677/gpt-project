import app from "./src/app.js";
import { connectDB } from "./src/config/db.js";
import initSocketServer from "./src/sockets/socket.server.js";
import http from "http";

const httpServer = http.createServer(app);
const PORT = process.env.PORT || 3000;

connectDB();
initSocketServer(httpServer);

httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
