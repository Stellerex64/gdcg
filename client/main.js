import { io } from "socket.io-client";

const API_URL = (import.meta.env.VITE_API_URL || "http://localhost:8080").replace(/\/$/, "");

const el = (tag, attrs={}, ...children) => {
  const n = document.createElement(tag);
  Object.entries(attrs).forEach(([k,v]) => {
    if (k === "class") n.className = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, v);
  });
  children.forEach(c => n.append(c));
  return n;
};

function App() {
  const root = document.getElementById("app");
  root.innerHTML = "";
  let role = "unauth"; // unauth | host | join | playing | spectator
  let name = "";
  let maxPlayers = 7;

  const socket = io(API_URL, { withCredentials:true });

  let publicState = null;
  let privateState = null;

  socket.on("server:hello", () => console.log("Connected"));
  socket.on("state:public", (st) => { publicState = st; render(); });
  socket.on("state:private", (st) => { privateState = st; render(); });
  socket.on("error:toast", (msg) => alert("Error: " + msg));
  socket.on("info:toast", (msg) => alert(msg));

  const loginView = () => {
    const wrap = el("div", { class: "wrap" },
      el("div", { class: "card" },
        el("div", { class: "row" },
          el("button", { onClick: () => { role = "host"; render(); } }, "Create Match"),
          el("button", { onClick: () => { role = "join"; render(); } }, "Join Match"),
        ),
      ),
    );
    return wrap;
  };

  const hostView = () => {
    const playersJoined = publicState?.players?.length || 0;
    const max = publicState?.maxPlayers || maxPlayers;

    const startLobby = () => {
      socket.emit("host:create", { maxPlayers: Number(maxPlayers), name });
      role = "playing";
    };

    const show = el("div", { class: "wrap" },
      el("div", { class: "card" },
        el("div", { class: "header" },
          el("div", {}, "Create Match"),
          el("div", { class: "muted" }, "Host selects player count and name")
        ),
        el("div", { class: "row" },
          el("label", {}, "Players:"),
          (() => {
            const sel = el("select", { });
            [3,4,5,6,7].forEach(n => {
              const opt = el("option", { value: String(n) }, String(n));
              if (n === max) opt.selected = true;
              sel.appendChild(opt);
            });
            sel.addEventListener("change", e => maxPlayers = Number(e.target.value));
            return sel;
          })(),
        ),
        el("div", { class: "row" },
          el("label", {}, "Team Name:"),
          (() => {
            const i = el("input", { placeholder: "Your team name" });
            i.addEventListener("input", e => name = e.target.value);
            return i;
          })(),
        ),
        el("div", { class: "row" },
          el("button", { onClick: startLobby }, "Start Lobby"),
          el("span", { class: "muted" }, `Slots: ${playersJoined}/${max}`)
        )
      )
    );
    return show;
  };

  const joinView = () => {
    const join = () => {
      socket.emit("player:join", { name });
      role = "playing"; // may become spectator depending on server
    };
    const slotsText = publicState?.maxPlayers
      ? `Slots: ${(publicState?.players?.length||0)}/${publicState.maxPlayers}`
      : "Waiting for host to set player count…";
    const full = publicState?.maxPlayers && (publicState.players?.length||0) >= publicState.maxPlayers;

    return el("div", { class: "wrap" },
      el("div", { class: "card" },
        el("div", { class: "header" },
          el("div", {}, "Join Match"),
          el("div", { class: "muted" }, slotsText)
        ),
        el("div", { class: "row" },
          el("label", {}, "Team Name:"),
          (() => {
            const i = el("input", { placeholder: "Your team name" });
            i.addEventListener("input", e => name = e.target.value);
            return i;
          })(),
        ),
        el("div", { class: "row" },
          !full ? el("button", { onClick: join }, "Join") :
                  el("button", { onClick: () => { role = 'spectator'; render(); } }, "View as Spectator")
        )
      )
    );
  };

  const boardView = () => {
    const header = el("div", { class: "wrap" },
      el("div", { class: "card" },
        el("div", { class: "header" },
          el("div", {}, "Game Board"),
          el("div", { class: "muted" }, publicState?.started ? "Started" : "Lobby")
        ),
        el("div", { class: "row" },
          el("div", {}, "Players:"),
          ...(publicState?.players || []).map(p => el("span", { class: "pill" }, p.name)),
        )
      )
    );

    const controls = el("div", { class: "wrap" },
      el("div", { class: "card" },
        el("div", { class: "row" },
          el("button", { onClick: () => socket.emit("host:start") }, "Host: Start Game"),
          el("button", { onClick: () => socket.emit("turn:draw", { deck: "Audience" }) }, "Draw Audience"),
          el("button", { onClick: () => socket.emit("turn:end") }, "End Turn")
        ),
        el("div", { class: "muted" }, "Demo controls. Replace with full UI later.")
      )
    );

    const hand = el("div", { class: "wrap" },
      el("div", { class: "card" },
        el("div", { class: "header" }, el("div", {}, "Your Hand"), el("div", { class: "muted" }, (privateState?.hand||[]).length + "/5")),
        el("div", { class: "row" },
          ...((privateState?.hand || []).map((c, idx) => el("span", { class: "pill" }, `${c.type} — ${c.title}`))),
        )
      )
    );

    return el("div", {}, header, controls, hand);
  };

  function render() {
    root.innerHTML = "";
    if (role === "unauth") root.append(loginView());
    else if (role === "host") root.append(hostView());
    else if (role === "join") root.append(joinView());
    else root.append(boardView());
  }

  render();
}

App();
