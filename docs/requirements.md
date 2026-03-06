# G-SEC Requirements Document
Secure Peer-to-Peer Communication Platform

## 1. Project Overview

G-SEC is a privacy-focused mobile messaging platform designed to provide:

- End-to-End Encryption
- Metadata minimization
- IP anonymity
- Forward secrecy
- Post-quantum readiness

The system is designed to prevent centralized surveillance, protect user identity, and ensure long-term cryptographic security.

The application will be built primarily as a **cross-platform mobile app using React Native**, with supporting backend services.

---

# 2. Core Goals

1. Ensure message confidentiality using modern encryption.
2. Hide user network identity and IP address.
3. Minimize metadata storage.
4. Provide forward secrecy through key ratcheting.
5. Support ephemeral messaging with cryptographic erasure.
6. Maintain acceptable performance on mobile devices.

---

# 3. System Architecture

## Components

### Mobile Client
React Native mobile application responsible for:

- User authentication
- Key generation and storage
- Message encryption/decryption
- P2P communication
- UI/UX

### Signaling Server

A lightweight Node.js server used only for:

- User discovery
- Session negotiation
- Offline message relay

The server **must never have access to plaintext messages or private keys.**

### Encryption Layer

Responsible for:

- Key exchange
- Message encryption
- Forward secrecy

Protocols used:

- X25519 Diffie-Hellman
- ChaCha20-Poly1305 AEAD
- Double Ratchet

### Anonymous Routing Layer

Uses TOR to:

- Hide IP addresses
- Route messages through onion circuits
- Prevent traffic analysis

### Secure Storage Layer

Stores sensitive data using hardware-backed storage:

- Android Keystore
- iOS Keychain

---

# 4. Functional Requirements

## Authentication

Users must be able to:

- Register
- Login
- Authenticate securely

Requirements:

- Password hashing with Argon2id
- Secure session tokens
- Hardware-backed credential storage

---

## Messaging

Users must be able to:

- Send encrypted messages
- Receive encrypted messages
- View chat history
- Delete messages

All messages must be encrypted end-to-end.

---

## Key Exchange

When two users begin a conversation:

1. Perform X25519 handshake
2. Establish shared secret
3. Derive session keys
4. Initialize Double Ratchet

Private keys must never leave the device.

---

## Forward Secrecy

Each message must:

- Use a unique derived key
- Update the ratchet state
- Delete old keys after use

This ensures past messages cannot be decrypted if a key is compromised.

---

## Ephemeral Messaging

Messages must support self-destruct timers.

When a message expires:

1. Associated encryption keys must be overwritten.
2. Ciphertext must become permanently unreadable.

This mechanism is called **cryptographic erasure**.

---

## Anonymous Routing

Users must be able to enable **Anonymous Mode**.

In this mode:

- All network traffic routes through TOR.
- User IP addresses are hidden.

---

## Device Security

The app must:

- Block screenshots
- Block screen recording
- Blur UI when app moves to background
- Prevent sensitive data caching

---

# 5. Non-Functional Requirements

## Performance

- Message latency < 2 seconds
- Encryption overhead optimized for mobile
- Minimal battery impact

---

## Security

The system must protect against:

- Man-in-the-middle attacks
- Metadata leakage
- IP tracking
- Key compromise
- Memory extraction

---

## Scalability

The signaling server must support:

- 1000+ concurrent users
- Horizontal scaling

---

# 6. Technology Stack

Mobile

- React Native
- TypeScript

Backend

- Node.js
- Express.js

Database

- MongoDB

Cryptography

- X25519
- ChaCha20-Poly1305
- Argon2id
- Double Ratchet

Network

- TOR integration

Security

- Android Keystore
- iOS Keychain

---

# 7. Security Model

The server must never have access to:

- Private keys
- Plaintext messages
- Decrypted metadata

Encryption and decryption must occur only on client devices.

---

# 8. Future Enhancements

- Post-quantum cryptography (lattice-based)
- Decentralized signaling
- Group messaging
- Voice/video calls
- Multi-device synchronization