const API_KEY = "$2a$10$W7r2d0gmDZE45aqzwLFbTumNYrlgnya.eify2ghIr2Ebrf0aupxWu";
const BIN_ID = "684ae0ef8561e97a502305dd";
const BIN_URL = `https://api.jsonbin.io/v3/b/${BIN_ID}`;
const HEADERS = {
  "X-Master-Key": API_KEY,
  "Content-Type": "application/json"
};

const createRoomBtn = document.getElementById("createRoomBtn");
const roomsContainer = document.getElementById("roomsContainer");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peer;
let currentCall;

async function initCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  localVideo.hidden = false;
}

async function getSalas() {
  const res = await fetch(BIN_URL + "/latest", { headers: HEADERS });
  const json = await res.json();
  return json.record.salas || {};
}

async function saveSalas(salas) {
  await fetch(BIN_URL, {
    method: "PUT",
    headers: HEADERS,
    body: JSON.stringify({ salas })
  });
}

async function refreshRooms() {
  const salas = await getSalas();
  roomsContainer.innerHTML = "";

  for (const id in salas) {
    const sala = salas[id];
    const roomDiv = document.createElement("div");
    roomDiv.className = "room";

    const label = document.createElement("div");
    label.textContent = `Sala ${id}`;

    const btn = document.createElement("button");
    if (sala.users >= 2) {
      btn.textContent = "Llena ❌";
      btn.disabled = true;
    } else {
      btn.textContent = "Unirse";
      btn.onclick = () => joinRoom(id);
    }

    roomDiv.appendChild(label);
    roomDiv.appendChild(btn);
    roomsContainer.appendChild(roomDiv);
  }
}

async function createRoom() {
  await initCamera();
  const id = Math.random().toString(36).substr(2, 6);
  const salas = await getSalas();
  salas[id] = { users: 1 };
  await saveSalas(salas);
  connectAsHost(id);
}

async function joinRoom(id) {
  const salas = await getSalas();
  if (!salas[id] || salas[id].users >= 2) return alert("Sala llena");

  salas[id].users = 2;
  await saveSalas(salas);

  peer = new Peer();
  peer.on("open", () => {
    const call = peer.call(id, localStream);
    call.on("stream", stream => {
      remoteVideo.srcObject = stream;
      remoteVideo.hidden = false;
    });
    currentCall = call;
  });
}

function connectAsHost(id) {
  peer = new Peer(id);
  peer.on("open", () => console.log("Sala creada:", id));
  peer.on("call", call => {
    call.answer(localStream);
    call.on("stream", stream => {
      remoteVideo.srcObject = stream;
      remoteVideo.hidden = false;
    });
    currentCall = call;
  });
}

// Refrescar lista de salas cada 5 segundos
setInterval(refreshRooms, 5000);

createRoomBtn.onclick = createRoom;
