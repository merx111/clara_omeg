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

const PING_INTERVAL = 10000;  // 10 segundos
const TIMEOUT = 15000;        // 15 segundos para considerar desconectado

let localStream;
let peer;
let currentCall;
let currentRoomId = null;

// Id único de este cliente
let clientId = Math.random().toString(36).substr(2, 9);

async function initCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  localVideo.hidden = false;
}

async function getSalas() {
  try {
    const res = await fetch(BIN_URL + "/latest", { headers: HEADERS });
    const json = await res.json();
    return json.record.salas || {};
  } catch (e) {
    console.error("Error al obtener salas:", e);
    return {};
  }
}

async function saveSalas(salas) {
  try {
    await fetch(BIN_URL, {
      method: "PUT",
      headers: HEADERS,
      body: JSON.stringify({ salas })
    });
  } catch (e) {
    console.error("Error al guardar salas:", e);
  }
}

// Envía ping para actualizar la hora de última actividad
async function sendPing(roomId) {
  if (!roomId) return;

  const salas = await getSalas();
  if (!salas[roomId]) return;

  if (!salas[roomId].clients) salas[roomId].clients = {};

  salas[roomId].clients[clientId] = Date.now();

  // Elimina clientes inactivos
  for (const cId in salas[roomId].clients) {
    if (Date.now() - salas[roomId].clients[cId] > TIMEOUT) {
      delete salas[roomId].clients[cId];
    }
  }

  // Actualiza número de usuarios activos
  salas[roomId].users = Object.keys(salas[roomId].clients).length;

  // Si no hay usuarios, elimina sala
  if (salas[roomId].users === 0) {
    delete salas[roomId];
  }

  await saveSalas(salas);
}

// Refresca la lista y limpia salas inactivas
async function refreshRooms() {
  let salas = await getSalas();

  // Limpieza general de salas
  const now = Date.now();
  for (const id in salas) {
    if (!salas[id].clients) salas[id].clients = {};
    for (const cId in salas[id].clients) {
      if (now - salas[id].clients[cId] > TIMEOUT) {
        delete salas[id].clients[cId];
      }
    }
    salas[id].users = Object.keys(salas[id].clients).length;
    if (salas[id].users === 0) delete salas[id];
  }
  await saveSalas(salas);

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

  salas[id] = {
    users: 1,
    clients: { [clientId]: Date.now() }
  };
  await saveSalas(salas);
  currentRoomId = id;
  connectAsHost(id);
  await refreshRooms();
  startPinging();
}

async function joinRoom(id) {
  await initCamera();

  const salas = await getSalas();
  if (!salas[id] || salas[id].users >= 2) return alert("Sala llena");

  if (!salas[id].clients) salas[id].clients = {};
  salas[id].clients[clientId] = Date.now();
  salas[id].users = Object.keys(salas[id].clients).length;
  await saveSalas(salas);

  currentRoomId = id;

  await refreshRooms();
  startPinging();

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

let pingIntervalId = null;

function startPinging() {
  if (pingIntervalId) clearInterval(pingIntervalId);
  pingIntervalId = setInterval(() => sendPing(currentRoomId), PING_INTERVAL);
}

// Limpiar sala al salir de la web
window.addEventListener("beforeunload", async () => {
  if (!currentRoomId) return;
  const salas = await getSalas();
  if (!salas[currentRoomId]) return;

  if (salas[currentRoomId].clients) {
    delete salas[currentRoomId].clients[clientId];
  }
  salas[currentRoomId].users = salas[currentRoomId].clients
    ? Object.keys(salas[currentRoomId].clients).length
    : 0;

  if (salas[currentRoomId].users === 0) {
    delete salas[currentRoomId];
  }

  await saveSalas(salas);
});

// Refrescar lista cada 5 segundos para mantener sincronización
setInterval(refreshRooms, 5000);

createRoomBtn.onclick = createRoom;

// Carga inicial
refreshRooms();
