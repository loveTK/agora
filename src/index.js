require("dotenv").config({ quiet: true });
const express = require("express");
const cors = require("cors");
const http = require("http");
const { Server } = require("socket.io");
const { runMigrations } = require("./db");
const { seedIfEmpty } = require("./seed");
const { regenerateSitemap } = require("./services/sitemap");
const { regenerateArchive } = require("./services/archivePage");

const authRoutes = require("./routes/auth");
const userRoutes = require("./routes/users");
const regionRoutes = require("./routes/regions");
const threadRoutes = require("./routes/threads");
const voteRoutes = require("./routes/votes");
const internalRoutes = require("./routes/internal");
const reportRoutes = require("./routes/reports");
const hallOfFameRoutes = require("./routes/hallOfFame");
const religionRoutes = require("./routes/religions");
const partyRoutes = require("./routes/parties");
const itemRoutes = require("./routes/items");
const warRoutes = require("./routes/wars");
const congressRoutes = require("./routes/congress");
const hotAgendaRoutes = require("./routes/hotAgenda");
const messageRoutes = require("./routes/messages");
const adminRoutes = require("./routes/admin");
const replyRoutes = require("./routes/replies");
const activityRoutes = require("./routes/activity");
const chatRoutes = require("./routes/chat");
const { requireAdmin } = require("./middleware/adminAuth");

runMigrations();
seedIfEmpty(); // Shell 접근이 안 되는 환경(Render 무료 티어 등)에서도 초기 데이터가 자동으로 채워지게 함
regenerateSitemap(); // 배포/재시작 시점 기준으로 sitemap.xml을 최신 지역/논제 목록으로 다시 씀
regenerateArchive(); // 논제 아카이브 페이지도 같은 시점에 최신 목록으로 다시 씀

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
app.use("/hall-of-fame", hallOfFameRoutes);
app.use("/religions", religionRoutes);
app.use("/parties", partyRoutes);
app.use("/items", itemRoutes);
app.use("/wars", warRoutes);
app.use("/congress-approvals", congressRoutes);
app.use("/hot-agenda", hotAgendaRoutes);
app.use("/messages", messageRoutes);
app.use("/admin", adminRoutes);
app.use("/replies", replyRoutes);
app.use("/activity", activityRoutes);
app.use("/chat", chatRoutes);
app.use("/internal", requireAdmin, internalRoutes);

app.use((req, res) => res.status(404).json({ error: "존재하지 않는 경로입니다." }));

const PORT = process.env.PORT || 4000;
httpServer.listen(PORT, () => {
  console.log(`AGORA 서버 실행 중 (HTTP + WebSocket) — http://localhost:${PORT}`);
});
