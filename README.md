# 🚀 Project Management Tool

> A modern full-stack project management application that enables teams to collaborate efficiently through project boards, task tracking, secure authentication, and real-time updates.

![React](https://img.shields.io/badge/React-18-blue)
![Node.js](https://img.shields.io/badge/Node.js-Express-green)
![JWT](https://img.shields.io/badge/Auth-JWT-orange)
![WebSocket](https://img.shields.io/badge/WebSocket-Real--Time-red)
![License](https://img.shields.io/badge/License-MIT-blue)

---

## 📌 Overview

Project Management Tool is a collaborative web application inspired by platforms such as Trello and Asana.

The application enables users to:

- Register and Login securely
- Create projects
- Organize tasks
- Assign work
- Track project progress
- Collaborate through comments
- Receive real-time updates

---

## ✨ Features

### Authentication

- Secure User Registration
- User Login
- JWT Authentication
- Password Encryption using bcrypt

### Project Management

- Create Projects
- View Projects
- Project Dashboard

### Task Management

- Create Tasks
- Edit Tasks
- Change Status
- Assign Members

### Collaboration

- Comment System
- Real-time Synchronization
- Live Project Updates

### Dashboard

- Task Statistics
- Completion Percentage
- Project Progress

---

# 🛠 Tech Stack

## Frontend

- React
- Vite
- Axios
- CSS

## Backend

- Node.js
- Express.js
- JWT
- bcrypt
- WebSocket

## Storage

- JSON File Storage

---

# 📂 Folder Structure

```
Project-Management-Tool
│
├── client
│   ├── src
│   ├── public
│   └── package.json
│
├── server
│   ├── data
│   ├── index.js
│   └── package.json
│
├── package.json
└── README.md
```

---

# 🚀 Installation

Clone the repository

```bash
git clone https://github.com/Ananduk177144/Project-Management-Tool.git
```

Move into the project

```bash
cd Project-Management-Tool
```

Install dependencies

```bash
npm install
```

Run both frontend and backend

```bash
npm run dev
```

Frontend

```
http://localhost:5173
```

Backend

```
http://localhost:5000
```

---

# 🔐 Environment Variables

Create a `.env` file inside the server folder.

```
JWT_SECRET=your_secret_key
PORT=5000
```

---

# 📡 API Endpoints

## Authentication

| Method | Endpoint |
|---------|----------|
| POST | /api/auth/register |
| POST | /api/auth/login |
| GET | /api/auth/me |

## Projects

| Method | Endpoint |
|---------|----------|
| GET | /api/projects |
| POST | /api/projects |

## Users

| Method | Endpoint |
|---------|----------|
| GET | /api/users |

---

# 📊 Project Architecture

```
React Frontend
        │
        ▼
 Axios Requests
        │
        ▼
Express Server
        │
        ├── JWT Authentication
        ├── WebSocket
        └── JSON Storage
```

---

# 📷 Screenshots

Add screenshots here.

```
screenshots/

login.png
dashboard.png
projects.png
tasks.png
```

---

# 🚧 Future Improvements

- MongoDB Integration
- Team Invitations
- File Uploads
- Email Notifications
- Kanban Drag & Drop
- Calendar View
- Dark Mode
- Activity Logs
- Docker Support

---

# 👨‍💻 Author

**Anandu K**

GitHub:

https://github.com/Ananduk177144

---

# 📜 License

This project is developed for educational and portfolio purposes.