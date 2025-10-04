# Spatial Audio Whiteboard

## Project Vision

A multiplayer whiteboard application where audio volume is controlled by spatial proximity. Users are represented as tokens (circular objects) on an infinite canvas. As you move your token closer to others, you hear them louder. Move away, and the volume decreases naturally. This recreates the physics of real-world conversations in a virtual space.

Think of it like a virtual conference room where people naturally cluster into conversation groups based on proximity, just like at a physical event.

## Core Concept

**The Problem We're Solving:**
Traditional video conferencing treats everyone equally - you hear everyone at the same volume regardless of context. This makes it hard to have multiple simultaneous conversations or to naturally form into groups.

**Our Solution:**
- Each user has a circular token showing their webcam feed (currently audio-only)
- Drag your token around an infinite canvas
- Volume automatically adjusts based on distance: `volume = 1 - (distance / MAX_HEARING_DISTANCE)`
- Stereo panning provides directional audio cues
- Natural conversation clustering emerges organically

## User Experience

### Basic Interactions
- **Move**: Drag your token to navigate the space
- **Hear**: Volume and stereo position adjust in real-time based on proximity
- **Zoom**: Scroll wheel to zoom in/out
- **Pan**: Shift+drag or middle-click to pan the canvas
- **Teleport**: Click "Go to" in user list to smoothly fly to within hearing range of someone

### Special Features
- **Megaphone Mode** (Admin): Override spatial audio to broadcast to everyone
- **Media Objects** (Planned): Drop YouTube videos, MP3s, images into the space
  - YouTube videos: Volume based on proximity, but timecode synced for all
  - MP3 audio sources: Act as speakers in space
  - Images: Become backdrops

### Natural Behaviors
- **Private conversations**: Move far from others to talk privately
- **Group formation**: Multiple people naturally gather around points of interest
- **Visual awareness**: You can see where everyone is, even if too far to hear
- **Comfortable teleport**: "Go to" brings you within 60% of max hearing range, not uncomfortably close

## Technical Architecture

### Frontend Stack
- **React 18**: UI and state management
- **HTML5 Canvas**: Infinite whiteboard rendering
- **Web Audio API**: Spatial audio processing (GainNode + StereoPannerNode)
- **Tailwind CSS**: Styling

### WebRTC Integration
- **VDO.Ninja**: P2P WebRTC mesh networking for audio streams
  - Why VDO.Ninja? Handles all WebRTC complexity (signaling, NAT traversal, TURN fallback)
  - Free hosted service at vdo.ninja
  - Can self-host later for production
  - IFRAME API for programmatic control
  
### Current Implementation

**What Works:**
- ✅ Infinite canvas with pan/zoom
- ✅ Draggable user tokens
- ✅ Distance-based volume calculation
- ✅ Stereo panning based on position
- ✅ VDO.Ninja integration for WebRTC audio
- ✅ Real-time spatial audio mixing
- ✅ User list with teleport functionality
- ✅ Smooth animated teleport (flies to comfortable distance)
- ✅ Room sharing (same room ID = same space)
- ✅ Mute/unmute controls
- ✅ Admin megaphone mode
- ✅ Visual indicators (speaking, muted, admin badge)

**What Doesn't Work Yet:**
- ❌ No persistence (positions reset on refresh)
- ❌ No WebSocket server for position sync (each client is isolated)
- ❌ No video feeds on tokens (audio-only currently)
- ❌ No media objects (YouTube, MP3, images)
- ❌ No actual microphone muting (just visual indicator)

### Audio Processing Pipeline

```
VDO.Ninja Peer Stream (MediaStream)
    ↓
Web Audio API MediaStreamSource
    ↓
GainNode (volume = f(distance))
    ↓
StereoPannerNode (pan = f(angle))
    ↓
AudioContext.destination (speakers)
```

Updated 10x per second based on token positions.

### Spatial Audio Math

**Volume Calculation:**
```javascript
volume = max(0, 1 - (distance / MAX_HEARING_DISTANCE))
```
- MAX_HEARING_DISTANCE = 400px (canvas units)
- Linear falloff (could experiment with exponential)
- Megaphone mode overrides to volume = 1.0

**Stereo Panning:**
```javascript
angle = atan2(dy, dx)
pan = sin(angle)  // -1 (left) to 1 (right)
```

**Teleport Target:**
```javascript
targetDistance = MAX_HEARING_DISTANCE * 0.6  // 60% = comfortable distance
targetX = user.x + cos(angle) * targetDistance
targetY = user.y + sin(angle) * targetDistance
```

## File Structure

```
/
├── index.html                  # Entry point, loads React/Babel
├── spatial-whiteboard.jsx      # Main React component
└── Claude.md                   # This file
```

## Key Technologies

### VDO.Ninja IFRAME API

**URL Parameters:**
- `room=${roomId}` - Shared room identifier
- `push=${myId}` - Your stream ID
- `label=${name}` - Display name
- `audioonly` - Audio streams only
- `novideo` - Don't request video
- `api` - Enable IFRAME API

**Message Events:**
- `track-added`: New peer joined (includes MediaStream)
- `track-removed`: Peer left
- `ready`: VDO.Ninja iframe initialized

### Web Audio API Usage

```javascript
// Create processing chain for each peer
const source = audioContext.createMediaStreamSource(stream);
const gainNode = audioContext.createGain();
const panNode = audioContext.createStereoPanner();

source.connect(gainNode);
gainNode.connect(panNode);
panNode.connect(audioContext.destination);

// Update based on position
gainNode.gain.value = calculateVolume(distance);
panNode.pan.value = calculatePan(angle);
```

## Next Steps

### Phase 1: Core Multiplayer (CURRENT PRIORITY)
- [ ] Add WebSocket server (Node.js + Socket.io)
- [ ] Sync token positions across clients
- [ ] Handle user join/leave events
- [ ] Persist state during session
- [ ] Add latency smoothing (interpolation)

### Phase 2: Video Integration
- [ ] Add webcam feeds to tokens (VDO.Ninja already supports this)
- [ ] Render video on canvas inside token circles
- [ ] Optimize performance (hide distant videos)
- [ ] Add video quality settings

### Phase 3: Media Objects
- [ ] YouTube embed with spatial audio
- [ ] Timecode synchronization for YouTube
- [ ] MP3 upload/playback as spatial audio sources
- [ ] Image upload as canvas objects
- [ ] Drag-and-drop for media

### Phase 4: Admin Features
- [ ] Admin controls (lock objects, kick users)
- [ ] Megaphone for any object (background music)
- [ ] User permissions system
- [ ] Room settings (max distance, etc.)

### Phase 5: Polish
- [ ] Minimap for navigation
- [ ] User avatars/profile pictures
- [ ] Chat system (text)
- [ ] Recording/playback
- [ ] Mobile responsive design

## Important Design Decisions

### Why VDO.Ninja?
1. **P2P by default** - No video server costs for small groups
2. **Battle-tested** - Used in production by streamers/broadcasters
3. **Free hosted service** - Can start without infrastructure
4. **Self-hostable** - Can deploy our own for production
5. **IFRAME API** - Programmatic control via postMessage

### Why Canvas Over WebGL?
- Simpler to start with
- Good enough performance for <50 users
- Can migrate to WebGL later if needed
- Easier to debug

### Why Audio-Only First?
- Proves the spatial concept
- Much lighter on bandwidth/CPU
- Faster to iterate
- Video is additive, not core to the concept

### Scaling Considerations
- **Mesh WebRTC** works up to ~10-15 users
- **Need SFU** (Selective Forwarding Unit) beyond that
- VDO.Ninja supports both mesh and SFU modes
- Plan to handle 50+ users in a single space

## Testing Instructions

### Local Development
1. Open `index.html` in a browser
2. Or use a local server: `python3 -m http.server 8000`
3. Open in multiple tabs/windows
4. Use the same Room ID in all instances
5. Grant microphone permissions
6. Start talking and move tokens around

### Multi-Device Testing
1. Host locally with ngrok or similar
2. Share URL to other devices
3. Test on different networks
4. Test with real network latency

## Known Issues

1. **No position sync** - Each client only sees themselves; others don't appear
2. **Mute doesn't work** - Need to integrate with VDO.Ninja's mute API
3. **No persistence** - Refresh loses all state
4. **Performance degrades with many users** - Need to optimize rendering
5. **No mobile support** - Touch events not implemented

## Architecture Decisions to Make

### Position Sync Approaches
**Option A: Centralized WebSocket**
- Pro: Simple, authoritative
- Con: Single point of failure, latency

**Option B: P2P Data Channels**
- Pro: Lower latency, no server costs
- Con: Mesh complexity, same scaling issues as video

**Recommendation:** Start with centralized WebSocket, add P2P data later

### Video Rendering
**Option A: Render video to canvas**
- Pro: Full control, can add effects
- Con: Performance overhead

**Option B: Overlay video elements**
- Pro: Browser-optimized
- Con: Harder to integrate with canvas

**Recommendation:** Start with Option A, optimize later

## Environment Variables (Future)

```
VDO_NINJA_URL=https://vdo.ninja  # Or self-hosted URL
WEBSOCKET_SERVER_URL=ws://localhost:3000
TURN_SERVER_URL=turn:your-turn-server.com
TURN_USERNAME=username
TURN_CREDENTIAL=password
MAX_HEARING_DISTANCE=400
ENABLE_VIDEO=false
ENABLE_MEDIA_OBJECTS=false
```

## Contributing Notes

- Keep spatial audio math simple and predictable
- Optimize rendering (only draw visible objects)
- Test with high latency networks
- Consider accessibility (keyboard navigation, screen readers)
- Mobile-first for Phase 5

## Contact & Resources

- VDO.Ninja Docs: https://docs.vdo.ninja
- VDO.Ninja GitHub: https://github.com/steveseguin/vdo.ninja
- Web Audio API Docs: https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API

---

**Last Updated:** 2025-01-16
**Status:** Prototype - Spatial audio works, needs multiplayer sync
**Next Milestone:** Add WebSocket server for position synchronization
