import type { PeerJSOption } from 'peerjs'

export function peerOptions(debug = 1): PeerJSOption {
  return {
    host: '0.peerjs.com',
    port: 443,
    path: '/',
    secure: true,
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' },
        { urls: 'stun:stun.relay.metered.ca:80' },
        {
          urls: 'turn:global.relay.metered.ca:80',
          username: 'ae5a0a389681d3e927dd044e',
          credential: 'jbEsdM33HM+mOspT',
        },
        {
          urls: 'turn:global.relay.metered.ca:80?transport=tcp',
          username: 'ae5a0a389681d3e927dd044e',
          credential: 'jbEsdM33HM+mOspT',
        },
        {
          urls: 'turn:global.relay.metered.ca:443',
          username: 'ae5a0a389681d3e927dd044e',
          credential: 'jbEsdM33HM+mOspT',
        },
        {
          urls: 'turns:global.relay.metered.ca:443?transport=tcp',
          username: 'ae5a0a389681d3e927dd044e',
          credential: 'jbEsdM33HM+mOspT',
        },
      ],
    },
    debug,
  }
}
