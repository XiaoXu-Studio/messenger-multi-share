/**
 * MAIN-world media adapter. The hosting page already receives the user-approved stream.
 * Page messages are untrusted; privileged cross-tab authorization lives in background.js.
 */
(function () {
  'use strict';
  if (!navigator.mediaDevices?.getDisplayMedia || globalThis.__mmsMediaInstalled) return;
  Object.defineProperty(globalThis, '__mmsMediaInstalled', {value:true});
  const nativeCapture = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
  const PREFIX = 'MMS_';
  let role = null, session = null, generation = 0;
  let peers = new Set();
  let capturedStream = null, receivedStream = null;
  const deliveredStreams = new Set(), peerConnections = new Map(), iceCandidateBuffers = new Map();
  const abort = () => new DOMException('共享已取消或过期', 'AbortError');
  const live = (s, g) => !!s && s === session && g === generation;
  const log = () => {}; // No SDP, ICE addresses, call URLs or page data in console logs.

  function stopStream(stream) { stream?.getTracks().forEach(track => track.stop()); }
  function cleanup() {
    generation++;
    role = null; session = null; peers.clear();
    stopStream(capturedStream); stopStream(receivedStream);
    for (const stream of deliveredStreams) stopStream(stream);
    deliveredStreams.clear();
    peerConnections.forEach(pc => pc.close());
    peerConnections.clear(); iceCandidateBuffers.clear();
    capturedStream = receivedStream = null;
  }
  function post(type, data) {
    window.postMessage({type:PREFIX + type, direction:'from-page', session, data}, location.origin);
  }
  function delivered(stream) {
    const clone = stream.clone();
    deliveredStreams.add(clone);
    clone.addEventListener('inactive', () => deliveredStreams.delete(clone), {once:true});
    return clone;
  }
  navigator.mediaDevices.getDisplayMedia = async function (constraints) {
    const s = session, g = generation, r = role;
    if (!s || !r) return nativeCapture(constraints);
    if (r === 'receiver') {
      if (!receivedStream?.active) await new Promise((resolve, reject) => {
        let elapsed = 0;
        const timer = setInterval(() => {
          elapsed += 200;
          if (!live(s, g)) { clearInterval(timer); reject(abort()); }
          else if (receivedStream?.active || elapsed >= 15000) { clearInterval(timer); resolve(); }
        }, 200);
      });
      if (!live(s, g)) throw abort();
      if (receivedStream?.active) {
        post('RECEIVER_SHARE_CONSUMED');
        return delivered(receivedStream);
      }
      post('RECEIVER_SHARE_TIMEOUT');
      // Preserve the explicit native picker fallback, never select a source automatically.
      const stream = await nativeCapture(constraints);
      if (!live(s, g)) { stopStream(stream); throw abort(); }
      capturedStream = stream;
      return delivered(stream);
    }
    try {
      const stream = await nativeCapture(constraints);
      if (!live(s, g)) { stopStream(stream); throw abort(); }
      stopStream(capturedStream);
      capturedStream = stream;
      stream.getVideoTracks().forEach(track => track.addEventListener('ended', () => {
        if (live(s, g)) { post('SOURCE_STREAM_ENDED'); cleanup(); }
      }, {once:true}));
      post('SOURCE_STREAM_READY');
      post('SOURCE_SHARE_CONSUMED');
      return delivered(stream);
    } catch (error) {
      if (live(s, g)) post('SOURCE_STREAM_ENDED');
      throw error;
    }
  };

  function createPC(remoteTabId) {
    if (!peers.has(remoteTabId)) throw new Error('Peer not authorized');
    peerConnections.get(remoteTabId)?.close();
    const s = session, g = generation;
    // Existing STUN service retained for connectivity; disclosed in README.
    const pc = new RTCPeerConnection({iceServers:[{urls:'stun:stun.l.google.com:19302'}]});
    peerConnections.set(remoteTabId, pc);
    if (!iceCandidateBuffers.has(remoteTabId)) iceCandidateBuffers.set(remoteTabId, []);
    pc.onicecandidate = event => {
      if (live(s, g) && event.candidate) post('SIGNAL_OUT', {
        targetTabId:remoteTabId, signal:{type:'candidate', candidate:event.candidate.toJSON()}
      });
    };
    pc.ontrack = event => {
      if (!live(s, g) || role !== 'receiver') { event.track.stop(); return; }
      receivedStream = event.streams[0] || new MediaStream([event.track]);
      post('RECEIVER_STREAM_READY');
    };
    pc.onconnectionstatechange = () => {
      if (!live(s, g)) return;
      if (['failed', 'disconnected'].includes(pc.connectionState)) {
        post('CONNECTION_FAILED', {remoteTabId});
        if (role === 'receiver') {
          stopStream(receivedStream);
          for (const stream of deliveredStreams) stopStream(stream);
          deliveredStreams.clear();
        }
      }
    };
    return pc;
  }
  async function flush(remoteTabId, s, g) {
    const pc = peerConnections.get(remoteTabId);
    const candidates = iceCandidateBuffers.get(remoteTabId) || [];
    iceCandidateBuffers.set(remoteTabId, []);
    for (const candidate of candidates) {
      if (!live(s, g)) return;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    }
  }
  async function command(message) {
    const data = message.data || {};
    if (message.type === PREFIX + 'SET_ROLE') {
      if (!['source','receiver'].includes(data.role) || typeof message.session !== 'string' ||
          !message.session || message.session.length > 64 || !Array.isArray(data.peers) ||
          data.peers.length > 128 || !data.peers.every(id => Number.isSafeInteger(id) && id >= 0)) return;
      cleanup();
      session = message.session; role = data.role; peers = new Set(data.peers);
      return;
    }
    if (message.type === PREFIX + 'STOP_SHARING') {
      if (session && message.session === session) cleanup();
      return;
    }
    const s = session, g = generation;
    if (!s || message.session !== s) return;
    if (message.type === PREFIX + 'CREATE_OFFER') {
      if (role !== 'source' || !peers.has(data.targetTabId) || !capturedStream?.active) return;
      const pc = createPC(data.targetTabId);
      capturedStream.getTracks().forEach(track => pc.addTrack(track, capturedStream));
      const offer = await pc.createOffer();
      if (!live(s, g)) { pc.close(); return; }
      await pc.setLocalDescription(offer);
      if (live(s, g)) post('SIGNAL_OUT', {targetTabId:data.targetTabId, signal:{type:'offer',sdp:pc.localDescription.sdp}});
      return;
    }
    if (message.type !== PREFIX + 'HANDLE_SIGNAL' || !peers.has(data.fromTabId)) return;
    const {fromTabId, signal} = data;
    if (!signal || typeof signal !== 'object') return;
    if (signal.type === 'offer' || signal.type === 'answer') {
      if (typeof signal.sdp !== 'string' || signal.sdp.length > 131072) return;
      if (signal.type === 'offer') {
        if (role !== 'receiver') return;
        const pc = createPC(fromTabId);
        await pc.setRemoteDescription({type:'offer',sdp:signal.sdp});
        if (!live(s, g)) { pc.close(); return; }
        await flush(fromTabId,s,g);
        const answer = await pc.createAnswer();
        if (!live(s,g)) { pc.close(); return; }
        await pc.setLocalDescription(answer);
        if (live(s,g)) post('SIGNAL_OUT',{targetTabId:fromTabId,signal:{type:'answer',sdp:pc.localDescription.sdp}});
      } else if (role === 'source') {
        const pc = peerConnections.get(fromTabId);
        if (!pc) return;
        await pc.setRemoteDescription({type:'answer',sdp:signal.sdp});
        if (live(s,g)) await flush(fromTabId,s,g);
      }
    } else if (signal.type === 'candidate' && signal.candidate &&
               typeof signal.candidate.candidate === 'string' && signal.candidate.candidate.length <= 8192) {
      const pc = peerConnections.get(fromTabId);
      if (pc?.remoteDescription) await pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
      else {
        const buffer = iceCandidateBuffers.get(fromTabId) || [];
        if (buffer.length >= 256) return;
        buffer.push(signal.candidate); iceCandidateBuffers.set(fromTabId,buffer);
      }
    }
  }
  window.addEventListener('message', event => {
    if (event.source !== window || event.origin !== location.origin || event.data?.direction !== 'to-page' ||
        typeof event.data?.type !== 'string' || !event.data.type.startsWith(PREFIX)) return;
    command(event.data).catch(log);
  });
})();
