# G-SEC Development Todo List

This file defines the step-by-step build order for implementing the G-SEC platform.

The tasks are ordered to allow incremental testing and stable development.

---

# Phase 1 — Project Setup

## Task 1.1 Initialize Mobile App

- Create React Native project
- Configure TypeScript
- Setup folder structure

Folders:

src/
components/
screens/
services/
crypto/
network/
storage/

---

## Task 1.2 Setup Backend Server

Create Node.js backend:

- Express server
- WebSocket support
- User signaling endpoints

Install dependencies:

express
ws
cors
dotenv

---

## Task 1.3 Setup Database

Create MongoDB schema:

Users
Sessions
OfflineMessages

Add indexes for performance.

---

# Phase 2 — Authentication System

## Task 2.1 User Registration

Implement API endpoint:

POST /register

Steps:

1. Receive username and password
2. Hash password using Argon2id
3. Store in MongoDB
4. Return auth token

---

## Task 2.2 User Login

Endpoint:

POST /login

Steps:

1. Validate password
2. Generate session token
3. Store active session

---

## Task 2.3 Secure Credential Storage

Mobile app must store:

- session token
- encryption keys

Use:

- Android Keystore
- iOS Keychain

---

# Phase 3 — Cryptography Layer

## Task 3.1 Key Generation

On first app launch:

Generate:

- Identity key pair
- Prekeys
- Session keys

Use X25519.

---

## Task 3.2 Key Exchange

When starting conversation:

1. Exchange public keys
2. Perform X25519 handshake
3. Derive shared secret

---

## Task 3.3 Message Encryption

Encrypt messages using:

ChaCha20-Poly1305

Steps:

1. Generate nonce
2. Encrypt message
3. Attach authentication tag

---

# Phase 4 — Double Ratchet

## Task 4.1 Implement Ratchet State

Create structure:

rootKey
chainKey
messageKey

---

## Task 4.2 Key Evolution

For every message:

- derive new message key
- update chain key
- delete previous key

---

## Task 4.3 Decryption Logic

On receiving message:

1. Advance ratchet
2. derive message key
3. decrypt message

---

# Phase 5 — Messaging System

## Task 5.1 P2P Signaling

Server handles:

- user discovery
- connection negotiation

---

## Task 5.2 Real-time Messaging

Use WebSockets.

Flow:

sender → encrypt → server relay → receiver → decrypt

---

## Task 5.3 Offline Messages

If user offline:

Server temporarily stores encrypted message.

Server must not decrypt messages.

---

# Phase 6 — Ephemeral Messaging

## Task 6.1 Self-Destruct Timers

Allow message expiration:

5s
30s
1min
1hour

---

## Task 6.2 Cryptographic Erasure

When timer expires:

- delete key
- overwrite memory
- remove message reference

---

# Phase 7 — TOR Integration

## Task 7.1 TOR Proxy

Integrate TOR client.

Route traffic through:

SOCKS proxy

---

## Task 7.2 Anonymous Mode Toggle

User setting:

Enable / Disable TOR routing.

---

# Phase 8 — Device Security

## Task 8.1 Screenshot Protection

Enable secure window flag.

---

## Task 8.2 Background Blur

When app backgrounded:

- blur UI
- hide message content

---

# Phase 9 — Security Testing

Perform tests:

- MITM attack simulation
- packet inspection
- memory dump analysis

---

# Phase 10 — Optimization

Optimize:

- encryption performance
- battery usage
- network latency

---

# Phase 11 — Final Release

Prepare:

- Android build
- iOS build
- security audit
- documentation