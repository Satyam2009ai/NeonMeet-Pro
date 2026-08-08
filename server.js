const express = require('express');
const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

// ==========================================
// BACKEND LOGIC: ADMIN & LOBBY TRACKING
// ==========================================
const roomAdmins = {}; 
const activeRooms = new Set(); // Track valid rooms

// ==========================================
// FULL FRONTEND (HTML + CSS + JS) IN ONE VARIABLE
// ==========================================
const frontendCode = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>NeonMeet | Scalable Edition</title>
    <style>
        :root {
            --neon-blue: #45f3ff; --neon-purple: #b52bfe;
            --neon-red: #ff2a5f; --neon-green: #00ff88; --surface: rgba(31, 40, 51, 0.7);
        }
        * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Segoe UI', sans-serif; }
        
        body { 
            background: linear-gradient(-45deg, #0b0c10, #2b0b3f, #0b2e3f, #3f0b22);
            background-size: 400% 400%; animation: gradientBG 15s ease infinite;
            color: white; height: 100vh; overflow: hidden; 
        }
        @keyframes gradientBG { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }

        .container { display: none; height: 100vh; width: 100vw; justify-content: center; align-items: center; }
        .container.active { display: flex; }
        .step-container { display: flex; flex-direction: column; align-items: center; justify-content: center; width: 100%; transition: 0.3s; }
        .hidden { display: none !important; }
        
        /* Circles */
        .circles-wrapper { display: flex; gap: 40px; margin-top: 2rem; flex-wrap: wrap; justify-content: center;}
        .neon-circle {
            width: 180px; height: 180px; border-radius: 50%; border: 3px solid var(--neon-blue);
            display: flex; justify-content: center; align-items: center; text-align: center;
            font-size: 1.5rem; font-weight: bold; cursor: pointer;
            box-shadow: 0 0 20px rgba(69, 243, 255, 0.3), inset 0 0 20px rgba(69, 243, 255, 0.3);
            transition: 0.4s; color: var(--neon-blue); text-transform: uppercase; letter-spacing: 2px;
            background: rgba(0,0,0,0.4); backdrop-filter: blur(5px);
        }
        .neon-circle:hover { background: var(--neon-blue); color: #000; box-shadow: 0 0 40px var(--neon-blue); transform: scale(1.05); }
        #circle-join { border-color: var(--neon-purple); color: var(--neon-purple); box-shadow: 0 0 20px rgba(181, 43, 254, 0.3), inset 0 0 20px rgba(181, 43, 254, 0.3);}
        #circle-join:hover { background: var(--neon-purple); color: white; box-shadow: 0 0 40px var(--neon-purple); transform: scale(1.05);}
        
        /* Forms & UI */
        .neon-text { font-size: 4rem; color: #fff; text-shadow: 0 0 10px var(--neon-blue), 0 0 20px var(--neon-blue); text-align: center; letter-spacing: 2px;}
        .neon-text-small { color: var(--neon-blue); text-shadow: 0 0 5px var(--neon-blue); margin-bottom: 0; text-align: center; }
        .action-box { background: var(--surface); backdrop-filter: blur(10px); padding: 2.5rem; border-radius: 20px; border: 1px solid rgba(255,255,255,0.1); display: flex; flex-direction: column; gap: 1.2rem; width: 350px; text-align: center; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .neon-btn { background: rgba(0,0,0,0.5); color: var(--neon-blue); border: 2px solid var(--neon-blue); padding: 12px 20px; font-size: 1.1rem; font-weight: bold; border-radius: 8px; cursor: pointer; transition: 0.3s; }
        .neon-btn:hover { background: var(--neon-blue); color: #000; box-shadow: 0 0 15px var(--neon-blue); }
        .neon-btn.outline { font-size: 0.9rem; padding: 8px 15px; border: 1px solid #888; color: #ddd; }
        .neon-btn.outline:hover { border-color: white; color: white; background: rgba(255,255,255,0.1); }
        .neon-btn.small { padding: 8px 15px; font-size: 0.9rem; border-color: var(--neon-green); color: var(--neon-green); }
        .neon-btn.small:hover { background: var(--neon-green); color: black; box-shadow: 0 0 10px var(--neon-green);}
        .neon-input { background: rgba(0,0,0,0.6); border: 1px solid #555; color: white; padding: 12px; font-size: 1rem; border-radius: 8px; outline: none; width: 100%; transition: 0.3s; }
        .neon-input:focus { border-color: var(--neon-blue); box-shadow: 0 0 10px rgba(69, 243, 255, 0.3); }
        
        /* Meeting Layout */
        .main-layout { display: flex; width: 100%; height: 100%; padding: 15px; gap: 15px; }
        .video-section { flex: 1; display: flex; flex-direction: column; background: rgba(0,0,0,0.6); backdrop-filter: blur(10px); border-radius: 15px; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);}
        .room-header { position: absolute; top: 10px; left: 10px; z-index: 10; display: flex; align-items: center; gap: 15px; background: rgba(0,0,0,0.8); padding: 10px 20px; border-radius: 10px; border: 1px solid #333;}
        
        #waiting-screen { position: absolute; top:0; left:0; width: 100%; height: 100%; display: none; flex-direction: column; justify-content: center; align-items: center; background: rgba(0, 0, 0, 0.9); z-index: 50; text-align: center;}
        #waiting-screen.waiting-active { display: flex; }
        .loader { width: 50px; height: 50px; border: 5px solid #333; border-top: 5px solid var(--neon-blue); border-radius: 50%; animation: spin 1s linear infinite; margin-bottom: 20px; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        
        #video-grid { flex: 1; display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; padding: 70px 15px 15px 15px; overflow-y: auto; align-items: center; justify-items: center; align-content: center;}
        .video-wrapper { position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 10px; overflow: hidden; border: 2px solid transparent; box-shadow: 0 5px 15px rgba(0,0,0,0.5); cursor: pointer; transition: 0.3s;}
        .video-wrapper:hover { border: 2px solid var(--neon-blue); box-shadow: 0 0 15px rgba(69,243,255,0.5); }
        .video-wrapper video { width: 100%; height: 100%; object-fit: cover; }
        .video-wrapper .name-tag { position: absolute; bottom: 5px; left: 5px; background: rgba(0,0,0,0.7); padding: 3px 8px; border-radius: 4px; font-size: 0.75rem; border: 1px solid rgba(255,255,255,0.2);}

        /* Buttons Fade Out Class */
        .disabled-btn { opacity: 0.3 !important; pointer-events: none !important; filter: grayscale(100%) !important; transition: 0.5s; }

        /* Controls */
        .controls { height: 70px; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); display: flex; justify-content: center; align-items: center; gap: 15px; border-top: 1px solid rgba(255,255,255,0.1); z-index: 10; transition: 0.5s;}
        .ctrl-btn { background: #333; border: 1px solid #444; color: white; width: 45px; height: 45px; border-radius: 50%; font-size: 1.2rem; cursor: pointer; transition: 0.3s; display: flex; justify-content: center; align-items: center;}
        .ctrl-btn:hover { background: #555; transform: translateY(-2px); }
        .ctrl-btn.active { background: rgba(69, 243, 255, 0.2); border: 1px solid var(--neon-blue); box-shadow: 0 0 10px rgba(69,243,255,0.3); }
        .ctrl-btn.danger { background: var(--neon-red); border-color: var(--neon-red); }
        .ctrl-btn.danger:hover { background: #ff003c; box-shadow: 0 0 15px var(--neon-red); transform: rotate(135deg) scale(1.1); }
        
        /* Side Panels */
        #side-panels { display: flex; gap: 15px; transition: 0.5s;}
        .panel { width: 300px; background: var(--surface); backdrop-filter: blur(10px); border-radius: 15px; display: flex; flex-direction: column; padding: 15px; border: 1px solid rgba(255,255,255,0.1); transition: 0.3s; box-shadow: 0 10px 30px rgba(0,0,0,0.5);}
        .panel-header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 10px;}
        #chat-window { flex: 1; overflow-y: auto; margin-bottom: 15px; padding-right: 5px; }
        #messages { list-style-type: none; display: flex; flex-direction: column; gap: 8px;}
        #messages li { padding: 8px 10px; background: rgba(255,255,255,0.1); border-radius: 8px; font-size: 0.9rem; border-left: 3px solid var(--neon-purple);}
        #messages li.my-message { background: rgba(69, 243, 255, 0.15); text-align: right; border-left: none; border-right: 3px solid var(--neon-blue);}
        #messages li b { font-size: 0.75rem; display: block; color: #ccc; margin-bottom: 2px;}
        #personal-notes { flex: 1; resize: none; background: rgba(0,0,0,0.5); color: white; }
        .chat-input-container { display: flex; gap: 5px; }
        
        /* Admin Request Popups */
        #admin-requests-container { position: fixed; top: 80px; left: 20px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; }
        .admin-request { background: rgba(0,0,0,0.9); border: 1px solid var(--neon-purple); padding: 15px; border-radius: 8px; color: white; box-shadow: 0 0 20px rgba(181, 43, 254, 0.4); display: flex; flex-direction: column; gap: 10px; animation: slideIn 0.3s forwards;}
        .admin-request-btns { display: flex; gap: 10px; justify-content: center;}

        /* Notifications */
        #notification-container { position: fixed; top: 20px; right: 20px; z-index: 1000; display: flex; flex-direction: column; gap: 10px; }
        .notification { background: rgba(0,0,0,0.9); border-left: 4px solid var(--neon-blue); padding: 15px 20px; border-radius: 5px; color: white; box-shadow: 0 4px 15px rgba(0,0,0,0.5); animation: slideIn 0.3s forwards, fadeOut 0.3s 3s forwards; }
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeOut { to { opacity: 0; display: none;} }
        
        @media (max-width: 768px) {
            .main-layout { flex-direction: column; padding: 5px; gap: 5px;}
            .hide-mobile { display: none; }
            .room-header { flex-direction: column; align-items: flex-start; padding: 5px;}
            .circles-wrapper { flex-direction: column; gap: 20px; }
            #side-panels { flex-direction: column; width: 100%; }
            .panel { width: 100%; height: 300px; }
        }
    </style>
</head>
<body>
    <div id="notification-container"></div>
    <div id="admin-requests-container"></div>
    
    <!-- Landing Page -->
    <div id="landing-page" class="container active">
        <div id="step-1-circles" class="step-container">
            <h1 class="neon-text">NeonMeet</h1>
            <div class="circles-wrapper">
                <div class="neon-circle" id="circle-create"><span>Create<br>Room</span></div>
                <div class="neon-circle" id="circle-join"><span>Join<br>Room</span></div>
            </div>
        </div>
        <div id="step-2-form" class="step-container hidden">
            <h1 class="neon-text" style="font-size: 2.5rem;">Almost there...</h1>
            <div class="action-box">
                <input type="text" id="username-input" placeholder="Enter Your Name" class="neon-input" required>
                <input type="text" id="room-input" placeholder="Enter Room ID" class="neon-input hidden">
                <button id="final-action-btn" class="neon-btn">Continue</button>
                <button id="back-btn" class="neon-btn outline" style="margin-top: 10px;">Back</button>
            </div>
        </div>
    </div>

    <!-- Meeting Room -->
    <div id="meeting-room" class="container hidden">
        <div class="main-layout">
            <div class="video-section">
                <div class="room-header">
                    <span id="room-id-display" class="neon-text-small"></span>
                    <button id="invite-btn" class="neon-btn small outline">Invite Friends 💌</button>
                    <span id="admin-badge" class="neon-text-small hidden" style="color:var(--neon-purple); border:1px solid var(--neon-purple); padding:2px 5px; border-radius:4px; font-size:0.8rem;">Room Admin</span>
                    <!-- Timer starts hidden -->
                    <span id="meeting-timer" class="neon-text-small hidden" style="margin-left: auto; color: var(--neon-green); font-weight: bold; font-size: 1.2rem; text-shadow: 0 0 10px var(--neon-green);">00:00</span>
                </div>
                
                <div id="waiting-screen" class="waiting-active">
                    <div class="loader"></div>
                    <h2 id="waiting-text">Connecting...</h2>
                    <p id="waiting-subtext">Please wait.</p>
                </div>
                <div id="video-grid"></div>
                
                <div class="controls" id="main-controls">
                    <!-- Mic and Cam are always visible, not faded -->
                    <button id="mic-btn" class="ctrl-btn active" title="Mute/Unmute">🎤</button>
                    <button id="cam-btn" class="ctrl-btn active" title="Camera On/Off">📷</button>
                    
                    <!-- Faded initially -->
                    <button id="screen-btn" class="ctrl-btn disabled-btn hide-mobile" title="Share Screen">💻</button>
                    <button id="hand-btn" class="ctrl-btn disabled-btn" title="Raise Hand">✋</button>
                    <button id="chat-toggle-btn" class="ctrl-btn disabled-btn" title="Toggle Chat">💬</button>
                    <button id="notes-toggle-btn" class="ctrl-btn disabled-btn hide-mobile" title="Take Notes">📝</button>
                    
                    <button id="leave-btn" class="ctrl-btn danger always-active" title="Leave Meeting" style="transform: rotate(135deg);">📞</button>
                </div>
            </div>
            
            <div id="side-panels" id="main-panels">
                <div id="chat-section" class="panel hidden">
                    <div class="panel-header">
                        <h3 class="neon-text-small">Live Chat</h3>
                        <button id="close-chat" class="neon-btn outline small">X</button>
                    </div>
                    <div id="chat-window"><ul id="messages"></ul></div>
                    <div class="chat-input-container">
                        <input type="text" id="chat-message" placeholder="Type a message..." class="neon-input">
                        <button id="send-btn" class="neon-btn small">Send</button>
                    </div>
                </div>
                <div id="notes-section" class="panel hidden">
                    <div class="panel-header">
                        <h3 class="neon-text-small">My Notes</h3>
                        <button id="close-notes" class="neon-btn outline small">X</button>
                    </div>
                    <p style="color:#ccc; font-size:0.8rem; margin-bottom: 10px;">Personal meeting notes.</p>
                    <textarea id="personal-notes" class="neon-input" placeholder="Type your points here..."></textarea>
                    <button id="download-notes-btn" class="neon-btn small" style="margin-top: 10px; width: 100%;">Download</button>
                </div>
            </div>
        </div>
    </div>

    <script src="/socket.io/socket.io.js"></script>
    <script>
        const socket = io();
        const videoGrid = document.getElementById('video-grid');
        let myVideoStream;
        let myPeerId = Math.random().toString(36).substr(2, 9);
        let myName = '';
        const peers = {};
        let isJoining = false;
        let globalRoomId = '';

        // Media states
        let hasRealAudio = false;
        let hasRealVideo = false;
        let isAudio = false;
        let isVideo = false;

        let timerStarted = false;
        let meetingStartTime;

        const step1 = document.getElementById('step-1-circles');
        const step2 = document.getElementById('step-2-form');
        const roomInput = document.getElementById('room-input');
        const waitingScreen = document.getElementById('waiting-screen');
        const waitingText = document.getElementById('waiting-text');
        const waitingSubtext = document.getElementById('waiting-subtext');

        // PUBLIC TURN SERVERS
        const iceServerConfig = { 
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:global.stun.twilio.com:3478' }
            ] 
        };

        document.getElementById('circle-create').addEventListener('click', () => {
            isJoining = false; roomInput.classList.add('hidden');
            step1.classList.add('hidden'); step2.classList.remove('hidden');
        });
        document.getElementById('circle-join').addEventListener('click', () => {
            isJoining = true; roomInput.classList.remove('hidden');
            step1.classList.add('hidden'); step2.classList.remove('hidden');
        });
        document.getElementById('back-btn').addEventListener('click', () => {
            step2.classList.add('hidden'); step1.classList.remove('hidden');
        });

        const urlParams = new URLSearchParams(window.location.search);
        if(urlParams.has('room')) {
            isJoining = true;
            roomInput.value = urlParams.get('room');
            roomInput.classList.remove('hidden');
            step1.classList.add('hidden'); step2.classList.remove('hidden');
        }

        function showNotification(msg) {
            const container = document.getElementById('notification-container');
            const notif = document.createElement('div');
            notif.className = 'notification'; notif.innerText = msg;
            container.appendChild(notif);
            setTimeout(() => notif.remove(), 3500);
        }

        function startTimer() {
            meetingStartTime = Date.now();
            setInterval(() => {
                const diff = Date.now() - meetingStartTime;
                const m = Math.floor(diff / 60000).toString().padStart(2, '0');
                const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
                const timerEl = document.getElementById('meeting-timer');
                if(timerEl) timerEl.innerText = m + ':' + s;
            }, 1000);
        }

        // ==========================================
        // UI BUTTON FADE & TIMER LOGIC
        // ==========================================
        function updateUIState() {
            const featureBtns = [
                document.getElementById('screen-btn'),
                document.getElementById('hand-btn'),
                document.getElementById('chat-toggle-btn'),
                document.getElementById('notes-toggle-btn')
            ];
            const timerEl = document.getElementById('meeting-timer');

            if (Object.keys(peers).length === 0) {
                // You are alone: disable tools, hide timer
                featureBtns.forEach(btn => btn.classList.add('disabled-btn'));
                timerEl.classList.add('hidden');
            } else {
                // Someone joined: enable tools, show timer
                featureBtns.forEach(btn => btn.classList.remove('disabled-btn'));
                timerEl.classList.remove('hidden');
                if (!timerStarted) {
                    startTimer();
                    timerStarted = true;
                }
            }
        }

        // INIT MEETING FLOW
        document.getElementById('final-action-btn').addEventListener('click', () => {
            myName = document.getElementById('username-input').value.trim() || 'User';
            globalRoomId = isJoining ? roomInput.value.trim() : Math.random().toString(36).substr(2, 9);
            if (isJoining && !globalRoomId) return alert('Please enter a Room ID');
            
            if (isJoining) {
                socket.emit('check-room-exists', globalRoomId);
            } else {
                proceedToMeeting();
            }
        });

        socket.on('room-exists-response', (exists) => {
            if (exists) {
                proceedToMeeting();
            } else {
                alert("❌ ROOM DOES NOT EXIST! Please check the invite link or create a new room.");
                window.location.href = '/';
            }
        });

        function proceedToMeeting() {
            window.history.pushState({}, '', '?room=' + globalRoomId);
            document.getElementById('room-id-display').innerText = 'Room: ' + globalRoomId;
            document.getElementById('landing-page').classList.remove('active');
            document.getElementById('landing-page').classList.add('hidden');
            document.getElementById('meeting-room').classList.remove('hidden');
            document.getElementById('meeting-room').classList.add('active');
            
            waitingText.innerText = "Connecting...";
            waitingSubtext.innerText = "Contacting server...";
            waitingScreen.classList.add('waiting-active');
            
            socket.emit('request-join', globalRoomId, myPeerId, myName);
        }

        socket.on('join-approved', async (isAdmin) => {
            if (isAdmin) {
                document.getElementById('admin-badge').classList.remove('hidden');
                showNotification("You are the Room Admin");
            } else {
                showNotification("Admin allowed you to join.");
            }
            startCameraAndWebRTC();
        });

        socket.on('waiting-for-admin', () => {
            waitingText.innerText = "Asking Admin...";
            waitingSubtext.innerText = "Please wait for permission to enter.";
        });

        socket.on('join-denied', () => {
            waitingText.innerText = "Access Denied";
            waitingSubtext.innerText = "The Room Admin declined your entry.";
            waitingText.style.color = "var(--neon-red)";
            document.querySelector('.loader').style.display = "none";
            setTimeout(() => window.location.href = '/', 3000);
        });

        socket.on('ask-admin-permission', (guestSocketId, guestPeerId, guestName) => {
            const container = document.getElementById('admin-requests-container');
            const reqDiv = document.createElement('div');
            reqDiv.className = 'admin-request';
            reqDiv.innerHTML = \`<p><b style="color:var(--neon-blue)">\${guestName}</b> wants to join.</p>
                                <div class="admin-request-btns">
                                   <button class="neon-btn small" id="allow-\${guestSocketId}">Allow</button>
                                   <button class="neon-btn small danger" id="deny-\${guestSocketId}">Deny</button>
                                </div>\`;
            container.appendChild(reqDiv);

            document.getElementById('allow-' + guestSocketId).addEventListener('click', () => {
                socket.emit('admin-response', guestSocketId, true, globalRoomId);
                reqDiv.remove();
            });
            document.getElementById('deny-' + guestSocketId).addEventListener('click', () => {
                socket.emit('admin-response', guestSocketId, false, globalRoomId);
                reqDiv.remove();
            });
        });

        // ----------------------------------------------------
        // WEBRTC & DUMMY STREAM (NO PERMISSION NEEDED TO ENTER)
        // ----------------------------------------------------
        function createDummyStream() {
            // Creates a black video and silent audio so WebRTC doesn't break
            const canvas = document.createElement('canvas');
            canvas.width = 320; canvas.height = 240;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#111'; ctx.fillRect(0, 0, 320, 240);
            ctx.fillStyle = '#45f3ff'; ctx.font = '20px Arial';
            ctx.fillText('Camera Off', 100, 120);
            const videoStream = canvas.captureStream(15);
            
            const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const dest = audioCtx.createMediaStreamDestination();
            return new MediaStream([videoStream.getVideoTracks()[0], dest.stream.getAudioTracks()[0]]);
        }

        const videoObserver = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                const video = entry.target;
                if (entry.isIntersecting) video.play();
                else video.pause(); 
            });
        }, { threshold: 0.1 });

        async function startCameraAndWebRTC() {
            try {
                myVideoStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { width: { ideal: 160 }, height: { ideal: 120 }, frameRate: { ideal: 10 } }, 
                    audio: true 
                });
                hasRealVideo = true; hasRealAudio = true;
                isAudio = true; isVideo = true;
            } catch (err) {
                console.warn("User denied camera/mic or no device found. Proceeding with dummy stream.");
                myVideoStream = createDummyStream();
                hasRealVideo = false; hasRealAudio = false;
                isAudio = false; isVideo = false;
                
                // Update buttons visually
                document.getElementById('mic-btn').classList.remove('active');
                document.getElementById('mic-btn').innerText = '🔇';
                document.getElementById('cam-btn').classList.remove('active');
            }

            const myVideo = document.createElement('video');
            myVideo.muted = true;
            addVideoStream(myVideo, myVideoStream, myPeerId, myName + ' (You)');
            
            socket.emit('join-room-final', globalRoomId, myPeerId, myName);
            checkEmptyRoom();
        }

        function checkEmptyRoom() {
            updateUIState();
            if (Object.keys(peers).length === 0) {
                waitingText.innerText = "You are the only one here.";
                waitingSubtext.innerText = "Features are disabled until someone joins.";
                document.querySelector('.loader').style.display = "block";
                waitingScreen.classList.add('waiting-active');
            } else {
                waitingScreen.classList.remove('waiting-active');
            }
        }

        socket.on('user-connected', async (userId, userName) => {
            showNotification(userName + ' joined!');
            const peerConnection = createPeerConnection(userId, userName);
            peers[userId] = { pc: peerConnection, name: userName };
            myVideoStream.getTracks().forEach(track => peerConnection.addTrack(track, myVideoStream));
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            socket.emit('offer', offer, userId);
            checkEmptyRoom();
        });

        socket.on('offer', async (offer, fromId) => {
            const peerConnection = createPeerConnection(fromId, "Participant");
            peers[fromId] = { pc: peerConnection, name: "Participant" };
            myVideoStream.getTracks().forEach(track => peerConnection.addTrack(track, myVideoStream));
            await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            socket.emit('answer', answer, fromId);
            checkEmptyRoom();
        });

        socket.on('answer', async (answer, fromId) => {
            if(peers[fromId]) await peers[fromId].pc.setRemoteDescription(new RTCSessionDescription(answer));
        });

        socket.on('ice-candidate', async (candidate, fromId) => {
            if (peers[fromId]) await peers[fromId].pc.addIceCandidate(new RTCIceCandidate(candidate));
        });

        socket.on('user-disconnected', userId => {
            if (peers[userId]) { peers[userId].pc.close(); delete peers[userId]; }
            const vid = document.getElementById('wrapper-' + userId);
            if (vid) vid.remove();
            checkEmptyRoom();
        });

        function createPeerConnection(userId, userName) {
            const pc = new RTCPeerConnection(iceServerConfig);
            pc.onicecandidate = (e) => { if (e.candidate) socket.emit('ice-candidate', e.candidate, userId); };
            pc.ontrack = (e) => {
                const video = document.createElement('video');
                addVideoStream(video, e.streams[0], userId, userName);
            };
            return pc;
        }

        function addVideoStream(video, stream, id, labelName) {
            if(document.getElementById('wrapper-' + id)) return; 
            const wrapper = document.createElement('div');
            wrapper.id = 'wrapper-' + id;
            wrapper.className = 'video-wrapper';
            const nameTag = document.createElement('div');
            nameTag.className = 'name-tag';
            nameTag.innerText = labelName || 'Participant';
            
            video.addEventListener('dblclick', () => {
                if (!document.fullscreenElement) video.requestFullscreen().catch(err => {});
                else document.exitFullscreen();
            });
            
            video.srcObject = stream;
            video.addEventListener('loadedmetadata', () => {
                video.play();
                videoObserver.observe(video);
            });
            wrapper.append(video, nameTag);
            videoGrid.append(wrapper);
        }

        // ==========================================
        // DYNAMIC CAMERA & MIC PERMISSIONS
        // ==========================================
        document.getElementById('mic-btn').addEventListener('click', async (e) => {
            if (!hasRealAudio) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                    const newTrack = stream.getAudioTracks()[0];
                    myVideoStream.removeTrack(myVideoStream.getAudioTracks()[0]);
                    myVideoStream.addTrack(newTrack);
                    hasRealAudio = true;
                    // Send to peers
                    for (let peerId in peers) {
                        const sender = peers[peerId].pc.getSenders().find(s => s.track.kind === 'audio');
                        if (sender) sender.replaceTrack(newTrack);
                    }
                } catch (err) {
                    return alert("Microphone permission denied! Please allow access in browser settings.");
                }
            }
            isAudio = !isAudio; 
            myVideoStream.getAudioTracks()[0].enabled = isAudio;
            e.target.classList.toggle('active', isAudio); 
            e.target.innerText = isAudio ? '🎤' : '🔇';
        });

        document.getElementById('cam-btn').addEventListener('click', async (e) => {
            if (!hasRealVideo) {
                try {
                    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 160 }, height: { ideal: 120 } } });
                    const newTrack = stream.getVideoTracks()[0];
                    myVideoStream.removeTrack(myVideoStream.getVideoTracks()[0]);
                    myVideoStream.addTrack(newTrack);
                    hasRealVideo = true;
                    // Update local video element
                    const myVidElement = document.querySelector('#wrapper-' + myPeerId + ' video');
                    if (myVidElement) myVidElement.srcObject = myVideoStream;
                    // Send to peers
                    for (let peerId in peers) {
                        const sender = peers[peerId].pc.getSenders().find(s => s.track.kind === 'video');
                        if (sender) sender.replaceTrack(newTrack);
                    }
                } catch (err) {
                    return alert("Camera permission denied! Please allow access in browser settings.");
                }
            }
            isVideo = !isVideo; 
            myVideoStream.getVideoTracks()[0].enabled = isVideo;
            e.target.classList.toggle('active', isVideo);
        });

        document.getElementById('leave-btn').addEventListener('click', () => window.location.href = '/');

        document.getElementById('screen-btn').addEventListener('click', async (e) => {
            try {
                const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
                const videoTrack = screenStream.getVideoTracks()[0];
                for (let peerId in peers) {
                    const sender = peers[peerId].pc.getSenders().find(s => s.track.kind === 'video');
                    if (sender) sender.replaceTrack(videoTrack);
                }
                const myVidElement = document.querySelector('#wrapper-' + myPeerId + ' video');
                if (myVidElement) myVidElement.srcObject = screenStream;
                e.target.classList.add('active');

                videoTrack.onended = () => {
                    for (let peerId in peers) {
                        const sender = peers[peerId].pc.getSenders().find(s => s.track.kind === 'video');
                        if (sender) sender.replaceTrack(myVideoStream.getVideoTracks()[0]);
                    }
                    if (myVidElement) myVidElement.srcObject = myVideoStream;
                    e.target.classList.remove('active');
                };
            } catch (err) {}
        });

        document.getElementById('invite-btn').addEventListener('click', async () => {
            const link = window.location.href;
            if (navigator.share) {
                try { await navigator.share({ title: 'Join NeonMeet', text: 'Click to join!', url: link }); } 
                catch(err) {}
            } else {
                navigator.clipboard.writeText(link);
                showNotification('Invite link copied!');
            }
        });

        document.getElementById('chat-toggle-btn').addEventListener('click', () => document.getElementById('chat-section').classList.toggle('hidden'));
        document.getElementById('close-chat').addEventListener('click', () => document.getElementById('chat-section').classList.add('hidden'));
        document.getElementById('notes-toggle-btn').addEventListener('click', () => document.getElementById('notes-section').classList.toggle('hidden'));
        document.getElementById('close-notes').addEventListener('click', () => document.getElementById('notes-section').classList.add('hidden'));

        document.getElementById('download-notes-btn').addEventListener('click', () => {
            const text = document.getElementById('personal-notes').value;
            if(!text) return alert("Your notes are empty!");
            const a = document.createElement('a');
            a.href = 'data:text/plain;charset=utf-8,' + encodeURIComponent(text);
            a.download = 'My_Meeting_Notes.txt';
            a.click();
        });

        const chatInput = document.getElementById('chat-message');
        const messagesList = document.getElementById('messages');
        document.getElementById('send-btn').addEventListener('click', sendMessage);
        chatInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendMessage(); });

        function sendMessage() {
            const text = chatInput.value.trim();
            if(text) {
                socket.emit('send-message', text, myName, globalRoomId);
                const li = document.createElement('li');
                li.className = 'my-message';
                li.innerHTML = '<b style="color:var(--neon-blue)">You</b><br>' + text;
                messagesList.appendChild(li);
                document.getElementById('chat-window').scrollTop = document.getElementById('chat-window').scrollHeight;
                chatInput.value = '';
            }
        }

        socket.on('create-message', (message, senderName) => {
            const li = document.createElement('li');
            li.innerHTML = '<b style="color:#ccc">' + senderName + '</b><br>' + message;
            messagesList.appendChild(li);
            document.getElementById('chat-window').scrollTop = document.getElementById('chat-window').scrollHeight;
        });
    </script>
</body>
</html>
`;

// ==========================================
// BACKEND ROUTES & SOCKET LOGIC
// ==========================================
app.get('/', (req, res) => {
    res.send(frontendCode);
});

io.on('connection', (socket) => {

    // INVALID ROOM CHECKER
    socket.on('check-room-exists', (roomId) => {
        socket.emit('room-exists-response', activeRooms.has(roomId));
    });

    socket.on('request-join', (roomId, peerId, userName) => {
        if (!roomAdmins[roomId]) {
            roomAdmins[roomId] = socket.id;
            activeRooms.add(roomId); 
            socket.emit('join-approved', true);
        } else {
            socket.emit('waiting-for-admin');
            io.to(roomAdmins[roomId]).emit('ask-admin-permission', socket.id, peerId, userName);
        }
    });

    socket.on('admin-response', (guestSocketId, isApproved, roomId) => {
        if (isApproved) {
            io.to(guestSocketId).emit('join-approved', false);
        } else {
            io.to(guestSocketId).emit('join-denied');
        }
    });

    socket.on('join-room-final', (roomId, userId, userName) => {
        socket.join(roomId);
        socket.to(roomId).emit('user-connected', userId, userName);
        
        socket.on('send-message', (message, senderName, room_id) => {
            socket.to(room_id).emit('create-message', message, senderName);
        });

        socket.on('offer', (offer, toId) => {
            socket.to(toId).emit('offer', offer, socket.id);
        });
        socket.on('answer', (answer, toId) => {
            socket.to(toId).emit('answer', answer, socket.id);
        });
        socket.on('ice-candidate', (candidate, toId) => {
            socket.to(toId).emit('ice-candidate', candidate, socket.id);
        });

        socket.on('disconnect', () => {
            socket.to(roomId).emit('user-disconnected', userId);
            
            if (roomAdmins[roomId] === socket.id) {
                delete roomAdmins[roomId];
                const clients = io.sockets.adapter.rooms.get(roomId);
                if (!clients || clients.size === 0) {
                    activeRooms.delete(roomId);
                } else {
                    const nextAdmin = Array.from(clients)[0];
                    roomAdmins[roomId] = nextAdmin;
                }
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => console.log('Server is LIVE on port ' + PORT));
