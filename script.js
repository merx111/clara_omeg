const roomsContainer = document.getElementById("roomsContainer");
const createRoomBtn = document.getElementById("createRoomBtn");
const localVideo = document.getElementById("localVideo");
const remoteVideo = document.getElementById("remoteVideo");

let localStream;
let peer;
let currentCall;
const rooms = {};

async function initCamera() {
  localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
  localVideo.srcObject = localStream;
}

function createRoom() {
  const roomId = Math.random().toString(36).substr(2, 6);
  rooms[roomId] = { users: 1 };

  addRoomToList(roomId);
  connectAsHost(roomId);
}

function addRoomToList(roomId) {
  const roomDiv = document.createElement("div");
  roomDiv.className = "room";
  roomDiv.id = `room-${roomId}`;

  const videoPreview = document.createElement("video");
  videoPreview.autoplay = true;
  videoPreview.muted = true;
  videoPreview.playsInline = true;
  videoPreview.srcObject = localStream;
  videoPreview.height = 80;

  const joinBtn = document.createElement("button");
  joinBtn.textContent = "Unirse";
  joinBtn.onclick = () => joinRoom(roomId);

  roomDiv.appendChild(videoPreview);
  roomDiv.appendChild(joinBtn);
  roomsContainer.appendChild(roomDiv);
}

function updateRoomStatus(roomId) {
  const room = rooms[roomId];
  const roomDiv = document.getElementById(`room-${roomId}`);
  if (room.users >= 2) {
    roomDiv.querySelector("button").remove(); // quitar botón
  }
}

function connectAsHost(roomId) {
  peer = new Peer(roomId);
  peer.on("open", id => console.log("Sala creada:", id));

  peer.on("call", call => {
    call.answer(localStream);
    call.on("stream", remoteStream => {
      remoteVideo.srcObject = remoteStream;
      remoteVideo.hidden = false;
    });
    rooms[roomId].users++;
    updateRoomStatus(roomId);
    currentCall = call;
  });
}

function joinRoom(roomId) {
  peer = new Peer();
  peer.on("open", id => {
    const call = peer.call(roomId, localStream);
    call.on("stream", remoteStream => {
      remoteVideo.srcObject = remoteStream;
      remoteVideo.hidden = false;
    });
    rooms[roomId].users++;
    updateRoomStatus(roomId);
    currentCall = call;
  });
}

createRoomBtn.onclick = async () => {
  await initCamera();
  createRoom();
};
