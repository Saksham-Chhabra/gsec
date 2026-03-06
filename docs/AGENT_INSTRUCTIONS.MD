# G-SEC Agent Instructions

Secure Peer-to-Peer Messaging Platform

This document provides instructions for autonomous coding agents responsible for implementing the G-SEC project.

The goal is to build a **secure mobile messaging platform focused on privacy, anonymity, and forward secrecy**.

Agents must strictly follow:

* `requirements.md`
* `todo.md`
* `AGENT_INSTRUCTIONS.md`

---

# 1. General Principles

1. Security-first architecture
2. Never expose private keys outside the device
3. The server must never access plaintext messages
4. Prefer well-tested cryptographic libraries over custom implementations
5. Implement features incrementally and ensure each phase works before continuing

**Important Rules**

* Do NOT invent cryptographic primitives
* Do NOT implement encryption manually
* Use audited libraries only

---

# 2. Project Overview

G-SEC is a privacy-focused messaging application that provides:

* End-to-End Encryption
* Forward Secrecy
* Metadata protection
* Anonymous routing via TOR
* Ephemeral messaging
* Device-level leak prevention

The architecture follows a **client-side cryptography model with minimal backend trust**.

---

# 3. Repository Structure

The project must follow this repository structure.

```
g-sec/

mobile/
    src/
        components/
        screens/
        hooks/
        services/
        crypto/
        network/
        storage/
        utils/

backend/
    src/
        controllers/
        routes/
        services/
        websocket/
        models/
        middleware/

docs/
    requirements.md
    todo.md
    AGENT_INSTRUCTIONS.md
```

Do not deviate from this structure unless necessary.

---

# 4. Technology Stack

## Mobile

Framework: React Native
Language: TypeScript

Recommended libraries:

* react-native-keychain
* react-navigation
* react-native-tcp-socket

---

## Backend

Runtime: Node.js
Framework: Express.js

Networking:

* WebSocket (`ws`)

---

## Database

Database: MongoDB

Collections:

* Users
* Sessions
* OfflineMessages

---

# 5. Cryptography Libraries

Never implement cryptographic primitives manually.

Use trusted libraries.

### Mobile

* libsodium
* tweetnacl
* react-native-libsodium

### Backend

* libsodium
* node-forge (only if required)

---

# 6. Encryption Protocol

The system must use the following algorithms:

### Key Exchange

X25519

### Message Encryption

ChaCha20-Poly1305

### Password Hashing

Argon2id

### Forward Secrecy

Double Ratchet Protocol

---

# 7. Key Management

All keys must be generated **on the client device**.

Key types:

* Identity Key
* Prekeys
* Session Keys
* Ratchet Keys

Private keys must be stored in secure hardware-backed storage:

Android:

* Android Keystore

iOS:

* iOS Keychain

Private keys must never leave the device.

---

# 8. Messaging Flow

When **User A sends a message to User B**:

1. Perform key exchange if a secure session does not exist.
2. Generate a message key from the Double Ratchet state.
3. Encrypt the message using ChaCha20-Poly1305.
4. Send the encrypted payload through the signaling server.
5. The receiver decrypts the message locally.

Important:

* The server must **only relay ciphertext**.
* The server must **never access plaintext data**.

---

# 9. Anonymous Routing

When **Anonymous Mode** is enabled:

* All network traffic must be routed through TOR.
* Traffic must pass through a SOCKS proxy.

Requirements:

* Prevent DNS leaks
* Prevent direct IP exposure

---

# 10. Ephemeral Messaging

Messages may include expiration timers.

Supported expiration types:

* Seconds
* Minutes
* Hours

When a message expires:

1. Delete the message
2. Overwrite the associated encryption key
3. Remove any stored references

This ensures **cryptographic erasure**.

---

# 11. Device Security

The mobile application must implement the following protections:

### Screenshot Protection

Enable secure window flags.

### Screen Recording Prevention

Prevent OS screen capture mechanisms.

### Background Privacy

When the app moves to the background:

* Blur the interface
* Hide chat contents

---

# 12. Security Requirements

The system must resist:

* Man-in-the-middle attacks
* Key compromise
* Metadata analysis
* IP tracking
* Traffic interception

Important:

* Never log sensitive information.
* Never store plaintext messages on the server.

---

# 13. Development Process

Agents must follow the **todo list in strict order**.

Development phases:

1. Project setup
2. Authentication
3. Cryptography layer
4. Messaging system
5. Forward secrecy implementation
6. Ephemeral messaging
7. TOR integration
8. Security hardening
9. Performance optimization

Agents must **complete each phase before moving to the next**.

---

# 14. Testing Strategy

Agents must implement tests for:

### Encryption correctness

Ensure encrypted messages decrypt correctly.

### Key exchange validation

Verify shared secrets match on both sides.

### Ratchet state evolution

Ensure message keys rotate properly.

### Message integrity

Verify tampering detection using authentication tags.

---

# 15. Code Quality Standards

Agents must follow these coding standards:

* Use TypeScript across the entire project
* Modularize services
* Avoid large monolithic files
* Add clear comments around cryptographic logic
* Follow consistent naming conventions

---

# 16. Security Constraints

The system must never:

* Disable encryption for debugging
* Log cryptographic keys
* Store plaintext messages
* Transmit private keys
* Keep sensitive keys in memory longer than required

---

# 17. Expected Deliverables

The final system must produce:

* A working React Native mobile application
* A Node.js signaling backend
* Secure encrypted messaging
* Forward secrecy using Double Ratchet
* Optional TOR anonymization mode
* Ephemeral messaging with cryptographic erasure
