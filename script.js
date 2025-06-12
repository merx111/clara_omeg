const API_KEY = "YOUR_JSONBIN_API_KEY";  // Cambia aquí tu API key
const BIN_ID = "YOUR_JSONBIN_BIN_ID";    // Cambia aquí tu bin id

const createRoomBtn = document.getElementById("createRoomBtn");
const roomsContainer = document.getElementById("roomsContainer");

const callArea = document.getElementById("callArea");
const hangupBtn = document.getElementById("hangupBtn");

const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream = null;
let peer = null;
let currentCall = null;

let clientId = Math.random().toString(36).substr(2, 9);
let currentRoomId = null;
let pingIntervalId = null;

createRoomBtn.onclick = createRoom;

hangupBtn.onclick = () => {
  leaveCall();
};

async function getSalas() {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}/latest`, {
      headers: {
        "X-Master-Key": API_KEY,
      },
    });
    if (!res.ok) throw new Error("Error leyendo JSONBin");
    const json = await res.json();
    return json.record || {};
  } catch (e) {
    console.error(e);
    return {};
  }
}

async function saveSalas(salas) {
  try {
    const res = await fetch(`https://api.jsonbin.io/v3/b/${BIN_ID}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        "X-Master-Key": API_KEY,
        "X-Bin-Versioning": "false",
      },
      body: JSON.stringify(salas),
    });
    if (!res.ok) throw new Error("Error guardando JSONBin");
  } catch (e) {
    console.error(e);
  }
}

async function refreshRooms() {
  const salas = await getSalas();
  roomsContainer.innerHTML = "";

  for (const id in salas) {
    if (!salas[id].clients) salas[id].clients = {};
    // Filtrar clientes que no han actualizado en 10 segundos
    const now = Date.now();
    for (const cId in salas[id].clients) {
      if (now - salas[id].clients[cId] > 10000) {
        delete salas[id].clients[cId];
      }
    }
    salas[id].users = Object.keys(salas[id].clients).length;

    if (salas[id].users === 0) {
      delete salas[id];
      continue;
    }

    // Guardamos limpieza
    await saveSalas(salas);

    if (salas[id].users < 2) {
      const btn = document.createElement("button");
      btn.className = "room";
      btn.textContent = `Unirse a sala ${id} (${salas[id].users} usuarios)`;
      btn.onclick = () => joinRoom(id);
      roomsContainer.appendChild(btn);
    }
  }
}

async function startPinging() {
  if (!currentRoomId) return;
  if (!pingIntervalId) {
    pingIntervalId = setInterval(async () => {
      const salas = await getSalas();
      if (!salas[currentRoomId]) return clearInterval(pingIntervalId);
      salas[currentRoomId].clients[clientId] = Date.now();
      salas[currentRoomId].users = Object.keys(salas[currentRoomId].clients).length;
      await saveSalas(salas);
    }, 4000);
  }
}

async function initCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
  localVideo.hidden = false;
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
  showCallUI();
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
  showCallUI();

  peer = new Peer();
  peer.on("open", () => {
    const call = peer.call(id, localStream);
    call.on("stream", stream => {
      remoteVideo.srcObject = stream;
      remoteVideo.hidden = false;
    });
    call.on("close", () => leaveCall());
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
    call.on("close", () => leaveCall());
    currentCall = call;
  });
}

function showCallUI() {
  callArea.hidden = false;
  createRoomBtn.disabled = true;
  roomsContainer.style.display = "none";
  hangupBtn.style.display = "block";
}

function hideCallUI() {
  callArea.hidden = true;
  createRoomBtn.disabled = false;
  roomsContainer.style.display = "block";
  hangupBtn.style.display = "none";
  localVideo.srcObject = null;
  remoteVideo.srcObject = null;
  localVideo.hidden = true;
  remoteVideo.hidden = true;
}

async function leaveCall() {
  if (currentCall) {
    currentCall.close();
    currentCall = null;
  }
  if (peer) {
    peer.destroy();
    peer = null;
  }

  if (currentRoomId) {
    const salas = await getSalas();
    if (salas[currentRoomId] && salas[currentRoomId].clients) {
      delete salas[currentRoomId].clients[clientId];
      salas[currentRoomId].users = Object.keys(salas[currentRoomId].clients).length;
      if (salas[currentRoomId].users === 0) delete salas[currentRoomId];
      await saveSalas(salas);
    }
    currentRoomId = null;
  }
  stopPinging();
  hideCallUI();
  await refreshRooms();
}

function stopPinging() {
  if (pingIntervalId) {
    clearInterval(pingIntervalId);
    pingIntervalId = null;
  }
}

window.addEventListener("beforeunload", async (e) => {
  if (currentRoomId) {
    await leaveCall();
  }
});

// Inicio
refreshRooms();
