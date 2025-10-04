const { useState, useEffect, useRef, useCallback } = React;

// Inline icon components (replacing lucide-react)
const Mic = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);

const MicOff = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <line x1="2" x2="22" y1="2" y2="22"/>
    <path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/>
    <path d="M5 10v2a7 7 0 0 0 12 5"/>
    <path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/>
    <path d="M9 9v3a3 3 0 0 0 5.12 2.12"/>
    <line x1="12" x2="12" y1="19" y2="22"/>
  </svg>
);

const Users = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
  </svg>
);

const Megaphone = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <path d="m3 11 18-5v12L3 14v-3z"/>
    <path d="M11.6 16.8a3 3 0 1 1-5.8-1.6"/>
  </svg>
);

const Radio = ({ size = 24, ...props }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
    <circle cx="12" cy="12" r="2"/>
    <path d="M4.93 19.07a10 10 0 0 1 0-14.14"/>
    <path d="M19.07 19.07a10 10 0 0 0 0-14.14"/>
  </svg>
);

const SpatialWhiteboard = () => {
  const canvasRef = useRef(null);
  const audioContextRef = useRef(null);
  const [users, setUsers] = useState([]);
  const [myId, setMyId] = useState(null);
  const [myName, setMyName] = useState('');
  const [joined, setJoined] = useState(false);
  const [dragging, setDragging] = useState(null);
  const [viewOffset, setViewOffset] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showUserList, setShowUserList] = useState(true);
  const [roomId, setRoomId] = useState('');
  const [vdoReady, setVdoReady] = useState(false);
  
  // VDO.Ninja refs
  const vdoIframeRef = useRef(null);
  const audioNodesRef = useRef({}); // Store audio nodes for each peer
  const peerStreamsRef = useRef({}); // Store MediaStream for each peer

  // Constants
  const TOKEN_RADIUS = 30;
  const MAX_HEARING_DISTANCE = 400;
  const CANVAS_WIDTH = 3000;
  const CANVAS_HEIGHT = 2000;

  // Initialize audio context
  useEffect(() => {
    audioContextRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, []);

  // Generate a random room ID on mount
  useEffect(() => {
    const randomRoom = 'spatial-' + Math.random().toString(36).substr(2, 9);
    setRoomId(randomRoom);
  }, []);

  // Handle VDO.Ninja messages
  useEffect(() => {
    const handleMessage = (event) => {
      // Only accept messages from vdo.ninja
      if (!event.origin.includes('vdo.ninja')) return;
      
      const data = event.data;
      
      // Track added - new peer joined
      if (data.action === 'track-added') {
        console.log('New peer track added:', data);
        const peerId = data.UUID;
        const stream = data.stream;
        
        if (stream && audioContextRef.current) {
          // Create audio processing chain for this peer
          const source = audioContextRef.current.createMediaStreamSource(stream);
          const gainNode = audioContextRef.current.createGain();
          const panNode = audioContextRef.current.createStereoPanner();
          
          source.connect(gainNode);
          gainNode.connect(panNode);
          panNode.connect(audioContextRef.current.destination);
          
          // Store nodes for this peer
          audioNodesRef.current[peerId] = { gainNode, panNode, source };
          peerStreamsRef.current[peerId] = stream;
          
          // Add user to list if not already there
          setUsers(prev => {
            if (prev.find(u => u.id === peerId)) return prev;
            return [...prev, {
              id: peerId,
              name: data.label || `User ${peerId.substr(0, 4)}`,
              x: Math.random() * 1000 + 500,
              y: Math.random() * 800 + 300,
              color: `hsl(${Math.random() * 360}, 70%, 60%)`,
              isSpeaking: false,
              isMuted: false,
              isAdmin: false,
              megaphoneActive: false
            }];
          });
        }
      }
      
      // Track removed - peer left
      if (data.action === 'track-removed') {
        console.log('Peer track removed:', data);
        const peerId = data.UUID;
        
        // Clean up audio nodes
        if (audioNodesRef.current[peerId]) {
          const { source, gainNode, panNode } = audioNodesRef.current[peerId];
          source.disconnect();
          gainNode.disconnect();
          panNode.disconnect();
          delete audioNodesRef.current[peerId];
          delete peerStreamsRef.current[peerId];
        }
        
        // Remove user from list
        setUsers(prev => prev.filter(u => u.id !== peerId));
      }
      
      // VDO.Ninja is ready
      if (data.action === 'ready') {
        console.log('VDO.Ninja iframe ready');
        setVdoReady(true);
      }
    };
    
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  // Update spatial audio based on positions
  useEffect(() => {
    if (!joined || !myId) return;
    
    const updateSpatialAudio = () => {
      const me = users.find(u => u.id === myId);
      if (!me) return;
      
      users.forEach(user => {
        if (user.id === myId) return;
        
        const nodes = audioNodesRef.current[user.id];
        if (!nodes) return;
        
        const dx = user.x - me.x;
        const dy = user.y - me.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Calculate volume
        let volume = calculateVolume(distance, user.megaphoneActive);
        nodes.gainNode.gain.value = volume;
        
        // Calculate stereo panning (-1 = left, 1 = right)
        if (distance > 0) {
          const angle = Math.atan2(dy, dx);
          const pan = Math.sin(angle); // Simple left/right panning
          nodes.panNode.pan.value = Math.max(-1, Math.min(1, pan));
        }
      });
    };
    
    const interval = setInterval(updateSpatialAudio, 100); // Update 10 times per second
    return () => clearInterval(interval);
  }, [users, myId, joined]);

  const handleJoin = () => {
    if (!myName.trim()) return;
    
    const newId = Math.random().toString(36).substr(2, 9);
    setMyId(newId);
    
    const newUser = {
      id: newId,
      name: myName,
      x: CANVAS_WIDTH / 2,
      y: CANVAS_HEIGHT / 2,
      color: `hsl(${Math.random() * 360}, 70%, 60%)`,
      isSpeaking: false,
      isMuted: false,
      isAdmin: true, // First user is admin for demo
      megaphoneActive: false
    };
    
    setUsers([newUser]);
    setJoined(true);
  };

  // Calculate volume based on distance
  const calculateVolume = (distance, megaphoneActive) => {
    if (megaphoneActive) return 1.0;
    if (distance > MAX_HEARING_DISTANCE) return 0;
    return Math.max(0, 1 - (distance / MAX_HEARING_DISTANCE));
  };

  // Drawing function
  useEffect(() => {
    if (!joined) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const dpr = window.devicePixelRatio || 1;
    
    // Set canvas size
    canvas.width = window.innerWidth * dpr;
    canvas.height = window.innerHeight * dpr;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    ctx.scale(dpr, dpr);
    
    const draw = () => {
      // Clear canvas
      ctx.fillStyle = '#f8f9fa';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      // Apply transformations
      ctx.save();
      ctx.translate(-viewOffset.x, -viewOffset.y);
      ctx.scale(zoom, zoom);
      
      // Draw grid
      ctx.strokeStyle = '#e0e0e0';
      ctx.lineWidth = 1 / zoom;
      const gridSize = 100;
      const startX = Math.floor(viewOffset.x / zoom / gridSize) * gridSize;
      const startY = Math.floor(viewOffset.y / zoom / gridSize) * gridSize;
      const endX = startX + (canvas.width / zoom / dpr) + gridSize;
      const endY = startY + (canvas.height / zoom / dpr) + gridSize;
      
      for (let x = startX; x < endX; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, startY);
        ctx.lineTo(x, endY);
        ctx.stroke();
      }
      for (let y = startY; y < endY; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(startX, y);
        ctx.lineTo(endX, y);
        ctx.stroke();
      }
      
      // Find my user
      const me = users.find(u => u.id === myId);
      
      // Draw hearing radius for my token
      if (me) {
        ctx.strokeStyle = 'rgba(100, 150, 255, 0.2)';
        ctx.lineWidth = 2 / zoom;
        ctx.setLineDash([10 / zoom, 10 / zoom]);
        ctx.beginPath();
        ctx.arc(me.x, me.y, MAX_HEARING_DISTANCE, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      }
      
      // Draw connection lines based on volume
      if (me) {
        users.forEach(user => {
          if (user.id === myId) return;
          
          const dx = user.x - me.x;
          const dy = user.y - me.y;
          const distance = Math.sqrt(dx * dx + dy * dy);
          const volume = calculateVolume(distance, user.megaphoneActive);
          
          if (volume > 0) {
            ctx.strokeStyle = `rgba(100, 150, 255, ${volume * 0.3})`;
            ctx.lineWidth = (2 + volume * 3) / zoom;
            ctx.beginPath();
            ctx.moveTo(me.x, me.y);
            ctx.lineTo(user.x, user.y);
            ctx.stroke();
            
            // Draw volume indicator
            const midX = (me.x + user.x) / 2;
            const midY = (me.y + user.y) / 2;
            ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
            ctx.fillRect(midX - 20 / zoom, midY - 10 / zoom, 40 / zoom, 20 / zoom);
            ctx.fillStyle = '#333';
            ctx.font = `${12 / zoom}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(`${Math.round(volume * 100)}%`, midX, midY);
          }
        });
      }
      
      // Draw tokens
      users.forEach(user => {
        const isMe = user.id === myId;
        
        // Draw megaphone indicator
        if (user.megaphoneActive) {
          ctx.fillStyle = 'rgba(255, 200, 0, 0.3)';
          ctx.beginPath();
          ctx.arc(user.x, user.y, TOKEN_RADIUS + 15, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw speaking indicator
        if (user.isSpeaking) {
          ctx.strokeStyle = user.color;
          ctx.lineWidth = 4 / zoom;
          ctx.beginPath();
          ctx.arc(user.x, user.y, TOKEN_RADIUS + 10, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        // Draw token
        ctx.fillStyle = user.color;
        ctx.beginPath();
        ctx.arc(user.x, user.y, TOKEN_RADIUS, 0, Math.PI * 2);
        ctx.fill();
        
        // Draw border
        ctx.strokeStyle = isMe ? '#000' : '#fff';
        ctx.lineWidth = 3 / zoom;
        ctx.stroke();
        
        // Draw muted indicator
        if (user.isMuted) {
          ctx.fillStyle = '#ff4444';
          ctx.beginPath();
          ctx.arc(user.x + TOKEN_RADIUS - 10, user.y - TOKEN_RADIUS + 10, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw admin indicator
        if (user.isAdmin) {
          ctx.fillStyle = '#ffd700';
          ctx.beginPath();
          ctx.arc(user.x - TOKEN_RADIUS + 10, user.y - TOKEN_RADIUS + 10, 8, 0, Math.PI * 2);
          ctx.fill();
        }
        
        // Draw name
        ctx.fillStyle = '#000';
        ctx.font = `bold ${14 / zoom}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillText(user.name, user.x, user.y + TOKEN_RADIUS + 10);
      });
      
      ctx.restore();
    };
    
    draw();
    const interval = setInterval(draw, 1000 / 30); // 30 FPS
    
    return () => clearInterval(interval);
  }, [users, myId, joined, viewOffset, zoom]);

  // Mouse handlers
  const getCanvasCoordinates = (clientX, clientY) => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const x = (clientX - rect.left + viewOffset.x) / zoom;
    const y = (clientY - rect.top + viewOffset.y) / zoom;
    return { x, y };
  };

  const handleMouseDown = (e) => {
    if (e.button === 1 || e.button === 2 || e.shiftKey) {
      // Middle mouse or right click or shift+click for panning
      setIsPanning(true);
      setPanStart({ x: e.clientX + viewOffset.x, y: e.clientY + viewOffset.y });
      e.preventDefault();
      return;
    }

    const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
    
    // Check if clicking on my token
    const me = users.find(u => u.id === myId);
    if (me) {
      const dx = x - me.x;
      const dy = y - me.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      
      if (distance < TOKEN_RADIUS) {
        setDragging({ offsetX: dx, offsetY: dy });
      }
    }
  };

  const handleMouseMove = (e) => {
    if (isPanning) {
      setViewOffset({
        x: panStart.x - e.clientX,
        y: panStart.y - e.clientY
      });
      return;
    }

    if (dragging) {
      const { x, y } = getCanvasCoordinates(e.clientX, e.clientY);
      
      setUsers(prev => prev.map(u => 
        u.id === myId 
          ? { ...u, x: x - dragging.offsetX, y: y - dragging.offsetY }
          : u
      ));
    }
  };

  const handleMouseUp = () => {
    setDragging(null);
    setIsPanning(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const delta = e.deltaY * -0.001;
    const newZoom = Math.min(Math.max(0.3, zoom + delta), 3);
    setZoom(newZoom);
  };

  // Toggle mute
  const toggleMute = () => {
    setIsMuted(!isMuted);
    setUsers(prev => prev.map(u => 
      u.id === myId ? { ...u, isMuted: !isMuted } : u
    ));
  };

  // Toggle megaphone (admin only)
  const toggleMegaphone = () => {
    const me = users.find(u => u.id === myId);
    if (!me?.isAdmin) return;
    
    setUsers(prev => prev.map(u => 
      u.id === myId ? { ...u, megaphoneActive: !u.megaphoneActive } : u
    ));
  };

  // Teleport to user with smooth animation
  const teleportToUser = (userId) => {
    const user = users.find(u => u.id === userId);
    const me = users.find(u => u.id === myId);
    if (!user || !me) return;
    
    // Calculate direction from target to me
    const dx = me.x - user.x;
    const dy = me.y - user.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    
    // Calculate position that's within comfortable hearing range (60% of max distance)
    const targetDistance = MAX_HEARING_DISTANCE * 0.6; // Not too close, not too far
    const angle = Math.atan2(dy, dx);
    
    const targetX = user.x + Math.cos(angle) * targetDistance;
    const targetY = user.y + Math.sin(angle) * targetDistance;
    
    // Animate the token movement
    const steps = 30;
    let currentStep = 0;
    
    const animate = () => {
      currentStep++;
      const progress = currentStep / steps;
      const easeProgress = 1 - Math.pow(1 - progress, 3); // Ease out cubic
      
      const newX = me.x + (targetX - me.x) * easeProgress;
      const newY = me.y + (targetY - me.y) * easeProgress;
      
      setUsers(prev => prev.map(u => 
        u.id === myId ? { ...u, x: newX, y: newY } : u
      ));
      
      // Also update view to follow
      const canvas = canvasRef.current;
      const centerX = (canvas.offsetWidth / 2) / zoom;
      const centerY = (canvas.offsetHeight / 2) / zoom;
      
      setViewOffset({
        x: newX * zoom - centerX * zoom,
        y: newY * zoom - centerY * zoom
      });
      
      if (currentStep < steps) {
        requestAnimationFrame(animate);
      }
    };
    
    animate();
  };

  if (!joined) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
        <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">Spatial Audio Whiteboard</h1>
          <p className="text-gray-600 mb-6">Join a room and experience proximity-based audio</p>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={myName}
                onChange={(e) => setMyName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleJoin()}
                placeholder="Enter your name"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Room ID
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={roomId}
                  onChange={(e) => setRoomId(e.target.value)}
                  placeholder="Room ID"
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(roomId);
                  }}
                  className="px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
                >
                  Copy
                </button>
              </div>
              <p className="text-xs text-gray-500 mt-1">Share this room ID with others to join the same space</p>
            </div>
            
            <button
              onClick={handleJoin}
              disabled={!myName.trim()}
              className="w-full bg-blue-600 text-white py-3 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Join Room
            </button>
          </div>
          
          <div className="mt-6 pt-6 border-t border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">How it works:</h3>
            <ul className="text-sm text-gray-600 space-y-1">
              <li>• Drag your token to move around</li>
              <li>• Volume adjusts based on distance</li>
              <li>• Scroll to zoom in/out</li>
              <li>• Shift+drag or middle-click to pan</li>
              <li>• Real WebRTC audio via VDO.Ninja</li>
            </ul>
          </div>
        </div>
      </div>
    );
  }

  const me = users.find(u => u.id === myId);

  return (
    <div className="relative w-screen h-screen overflow-hidden">
      {/* Hidden VDO.Ninja iframe for WebRTC */}
      <iframe
        ref={vdoIframeRef}
        src={`https://vdo.ninja/?room=${roomId}&push=${myId}&label=${encodeURIComponent(myName)}&audioonly&screenshare=0&novideo&api`}
        allow="camera;microphone;display-capture;autoplay;clipboard-write"
        style={{ 
          position: 'absolute', 
          width: '1px', 
          height: '1px', 
          border: 'none',
          opacity: 0,
          pointerEvents: 'none'
        }}
      />
      
      {/* Canvas */}
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onWheel={handleWheel}
        onContextMenu={(e) => e.preventDefault()}
        className="cursor-move"
      />
      
      {/* Controls */}
      <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 space-y-2">
        <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
          <Radio size={16} className={vdoReady ? 'text-green-500' : 'text-gray-400'} />
          <span className="text-xs text-gray-600">
            {vdoReady ? 'WebRTC Connected' : 'Connecting...'}
          </span>
        </div>
        
        <button
          onClick={toggleMute}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
            isMuted 
              ? 'bg-red-500 text-white hover:bg-red-600' 
              : 'bg-blue-500 text-white hover:bg-blue-600'
          }`}
        >
          {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
          {isMuted ? 'Unmute' : 'Mute'}
        </button>
        
        {me?.isAdmin && (
          <button
            onClick={toggleMegaphone}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              me.megaphoneActive
                ? 'bg-yellow-500 text-white hover:bg-yellow-600'
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            <Megaphone size={20} />
            Megaphone
          </button>
        )}
        
        <div className="pt-2 border-t border-gray-200 text-sm text-gray-600">
          <div className="font-semibold mb-1">Room ID:</div>
          <div className="flex items-center gap-2">
            <code className="text-xs bg-gray-100 px-2 py-1 rounded flex-1 overflow-hidden text-ellipsis">
              {roomId}
            </code>
            <button
              onClick={() => navigator.clipboard.writeText(roomId)}
              className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
            >
              Copy
            </button>
          </div>
          <div className="mt-2">Zoom: {Math.round(zoom * 100)}%</div>
          <div className="text-xs mt-1">Scroll to zoom</div>
          <div className="text-xs">Shift+drag to pan</div>
        </div>
      </div>
      
      {/* User List */}
      <div className="absolute top-4 right-4 bg-white rounded-lg shadow-lg w-64">
        <div 
          className="flex items-center justify-between p-4 border-b border-gray-200 cursor-pointer"
          onClick={() => setShowUserList(!showUserList)}
        >
          <div className="flex items-center gap-2">
            <Users size={20} />
            <span className="font-semibold">Users ({users.length})</span>
          </div>
          <span className="text-gray-500">{showUserList ? '−' : '+'}</span>
        </div>
        
        {showUserList && (
          <div className="max-h-96 overflow-y-auto">
            {users.map(user => {
              const isMe = user.id === myId;
              const myUser = users.find(u => u.id === myId);
              let distance = 0;
              let volume = 0;
              
              if (myUser && !isMe) {
                const dx = user.x - myUser.x;
                const dy = user.y - myUser.y;
                distance = Math.sqrt(dx * dx + dy * dy);
                volume = calculateVolume(distance, user.megaphoneActive);
              }
              
              return (
                <div
                  key={user.id}
                  className={`p-3 border-b border-gray-100 hover:bg-gray-50 ${
                    isMe ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div
                        className="w-8 h-8 rounded-full flex-shrink-0"
                        style={{ backgroundColor: user.color }}
                      />
                      <div>
                        <div className="font-medium text-sm flex items-center gap-1">
                          {user.name}
                          {isMe && <span className="text-xs text-gray-500">(you)</span>}
                          {user.isAdmin && <span className="text-xs text-yellow-600">★</span>}
                        </div>
                        {!isMe && (
                          <div className="text-xs text-gray-500">
                            {Math.round(distance)}px • {Math.round(volume * 100)}% vol
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {!isMe && (
                      <button
                        onClick={() => teleportToUser(user.id)}
                        className="text-xs bg-blue-100 text-blue-600 px-2 py-1 rounded hover:bg-blue-200"
                      >
                        Go to
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-1 mt-2">
                    {user.isSpeaking && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                        Speaking
                      </span>
                    )}
                    {user.isMuted && (
                      <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded">
                        Muted
                      </span>
                    )}
                    {user.megaphoneActive && (
                      <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                        Megaphone
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
      
      {/* Info */}
      <div className="absolute bottom-4 left-4 bg-white rounded-lg shadow-lg p-3 text-sm text-gray-600">
        <div className="font-semibold mb-1">Controls:</div>
        <div>• Drag your token to move</div>
        <div>• Scroll to zoom</div>
        <div>• Shift+drag to pan canvas</div>
        <div>• Volume based on distance</div>
      </div>
    </div>
  );
};

// Make it globally available for index.html
window.SpatialWhiteboard = SpatialWhiteboard;
