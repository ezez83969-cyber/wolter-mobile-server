
const http = require("http");
const WebSocket = require("ws");
const crypto = require("crypto");

const PORT = process.env.PORT || 8080;

// Первый запуск: владелец задаёт секретный пароль
const OWNER_KEY = process.env.WOLTER_OWNER_KEY;

if (!OWNER_KEY || OWNER_KEY.length < 16) {
  console.error("Задай WOLTER_OWNER_KEY длиной не менее 16 символов.");
  process.exit(1);
}

const players = new Map();

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Wolter Mobile Online RP server is running");
});

const wss = new WebSocket.Server({ server });

function broadcast(data, except) {
  const message = JSON.stringify(data);
  for (const client of wss.clients) {
    if (client !== except && client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  }
}

wss.on("connection", (ws) => {
  const id = crypto.randomUUID();

  const player = {
    id,
    name: "Игрок",
    x: 3,
    z: 5,
    admin: 0
  };

  players.set(id, player);

  ws.send(JSON.stringify({
    type: "welcome",
    id,
    players: [...players.values()]
  }));

  broadcast({ type: "join", player }, ws);

  ws.on("message", (raw) => {
    if (raw.length > 2048) return;

    let data;
    try {
      data = JSON.parse(raw.toString());
    } catch {
      return;
    }

    if (data.type === "ownerLogin") {
      if (typeof data.key === "string" &&
          crypto.timingSafeEqual(
            crypto.createHash("sha256").update(data.key).digest(),
            crypto.createHash("sha256").update(OWNER_KEY).digest()
          )) {
        player.admin = 10;
        ws.send(JSON.stringify({
          type: "owner",
          message: "Ты вошёл как владелец сервера!",
          admin: 10
        }));
      } else {
        ws.send(JSON.stringify({
          type: "error",
          message: "Неверный ключ владельца."
        }));
      }
      return;
    }

    if (data.type === "move") {
      if (![data.x, data.z].every(
        n => typeof n === "number" && Number.isFinite(n) && Math.abs(n) < 10000
      )) return;

      player.x = data.x;
      player.z = data.z;
      broadcast({ type: "move", id, x: player.x, z: player.z }, ws);
    }

    if (data.type === "setName" && typeof data.name === "string") {
      player.name = data.name.replace(/[<>]/g, "").slice(0, 20) || "Игрок";
      broadcast({ type: "rename", id, name: player.name });
    }
  });

  ws.on("close", () => {
    players.delete(id);
    broadcast({ type: "leave", id });
  });
});

server.listen(PORT, "0.0.0.0", () => {
  console.log(`Wolter Mobile RP server: http://localhost:${PORT}`);
  console.log("Для подключения через интернет потребуется публичный хостинг.");
});




