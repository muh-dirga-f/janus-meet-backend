# 📡 Janus Meet – Backend

> Real-time video meeting app using **Janus Gateway (SFU)** + WebRTC.
> Repo ini adalah sisi **Back-end**, menangani autentikasi, manajemen room, dan relay sinyal WebSocket.

---

## 📦 Tech Stack

* **Runtime**: Node.js 18 + TypeScript
* **Framework**: Express + Socket.IO
* **DB**: PostgreSQL + Prisma ORM
* **Auth**: JWT (access + refresh)
* **Janus Gateway**: HTTP Admin API
* **Testing**: Jest + Supertest

---

## 🌐 Arsitektur

* REST API → `/api/**`
* WebSocket → `/ws`
* JWT digunakan di `Authorization: Bearer` & `refreshToken` (cookie)
* Terintegrasi dengan Front-end `janus-meet-frontend` via OpenAPI

---

## 🚀 Endpoints (REST API)

| Method | Path                         | Auth   | Deskripsi                           |
| ------ | ---------------------------- | ------ | ----------------------------------- |
| POST   | `/api/auth/register`         | –      | Register user baru (cookie refresh) |
| POST   | `/api/auth/login`            | –      | Login user, response token baru     |
| POST   | `/api/auth/refresh`          | Cookie | Refresh access token via cookie     |
| GET    | `/api/auth/me`               | Bearer | Data user login                     |
| GET    | `/api/rooms`                 | Bearer | List semua room aktif               |
| POST   | `/api/rooms`                 | Bearer | Buat room baru via Janus Admin      |
| GET    | `/api/rooms/:id`             | Bearer | Detail room + participants          |
| DELETE | `/api/rooms/:id`             | Bearer | Hanya host bisa hapus               |
| GET    | `/api/rooms/:id/messages`    | Bearer | Chat histori (paging by ts)         |
| GET    | `/api/rooms/:id/janus-token` | Bearer | (opsional) JWT untuk Janus client   |

---

## 🔌 WebSocket API (`/ws`)

### Client → Server

| Event          | Payload        |
| -------------- | -------------- |
| `join-room`    | `{ roomId }`   |
| `leave-room`   | –              |
| `janus-signal` | `{ to, data }` |
| `chat-send`    | `{ text }`     |

### Server → Client

| Event         | Payload        |
| ------------- | -------------- |
| `peer-joined` | `{ id, name }` |
| `peer-left`   | `{ id }`       |
| `chat-new`    | `Message`      |
| `room-ended`  | –              |
| `forced-mute` | –              |

> 🔐 Autentikasi WebSocket memakai `socket.handshake.auth.token` (Bearer JWT).

---

## ⚙️ Instalasi Lokal

```bash
git clone https://github.com/your-org/janus-meet-backend.git
cd janus-meet-backend
cp .env.example .env
npm install
npx prisma migrate dev
npm run dev
```

---

## 🧪 Testing

Jalankan semua tes:

```bash
npm run test
```

Cakupan:

* Register / Login / Refresh
* Guard Token & Role Host
* Validasi struktur response

---

## 🗄️ Prisma Schema (DB)

* `User`: Info akun
* `Room`: Data meeting room
* `Message`: Chat dalam room

Lihat `prisma/schema.prisma` untuk detail lengkap.

---

## 📁 Struktur Proyek

```
.
├── prisma/               # Schema dan migrasi database
├── src/
│   ├── controllers/      # Endpoint handler (auth, room)
│   ├── middleware/       # JWT guard
│   ├── routes/           # REST API routes
│   ├── sockets/          # WebSocket gateway (janus, chat)
│   └── server.ts         # Entry point Express + Socket.IO
├── openapi.yaml          # Auto-generated dari Zod schema
├── .env                  # Config ENV
├── jest.config.js        # Unit test config
└── package.json
```

---

## 🧱 CI Pipeline

> (Wajib lulus sebelum merge)

```txt
→ lint
→ test (jest + supertest)
→ docker build
```

---

## 🔐 Token Policy

* **Access Token**: 15 menit, dikirim via `Authorization: Bearer`
* **Refresh Token**: 7 jam, disimpan dalam `HttpOnly cookie`

---

## 🐳 Docker Compose

Gunakan file `docker-compose.yml` (lihat repo utama) untuk menjalankan:

* PostgreSQL
* Janus Gateway
* Backend & Frontend

```bash
docker compose up --build
```

---