require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { runMigrations } = require("./db");
const { seedIfEmpty } = require("./seed");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const regionRoutes = require("./routes/regions");
const threadRoutes = require("./routes/threads");
const voteRoutes = require("./routes/votes");
const internalRoutes = require("./routes/internal");
const reportRoutes = require("./routes/reports");
const { requireAdmin } = require("./middleware/adminAuth");

runMigrations();
seedIfEmpty(); // Shell 접근이 안 되는 환경(Render 무료 티어 등)에서도 초기 데이터가 자동으로 채워지게 함

const app = express();
app.use(cors());
app.use(express.json());

const httpServer = http.createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } });
app.set("io", io); // 라우트에서 req.app.get("io")로 꺼내 실시간 이벤트를 쏠 수 있게 함

io.on("connection", (socket) => {
  // 지도 화면 접속 시 현재 스냅샷을 한 번 보내주고, 이후엔 region:update 이벤트로 변경분만 받는다.
  console.log(`[socket] client connected: ${socket.id}`);
  socket.on("disconnect", () => console.log(`[socket] client disconnected: ${socket.id}`));
});

app.get("/health", (req, res) => res.json({ ok: true, phase: "S4" }));

app.use("/auth", authRoutes);
app.use("/users", userRoutes);
app.use("/regions", regionRoutes);
app.use("/threads", threadRoutes);
app.use("/arguments", voteRoutes);
app.use("/reports", reportRoutes);
app.use("/internal", requireAdmin, internalRoutes);

app.use((req, res) => res.status(404).json({ error: "존재하지 않는 경로입니다." }));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`AGORA 서버 실행 중 (HTTP + WebSocket) — http://localhost:${PORT}`);
});
