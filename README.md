# Project Management Tool

A modern, collaborative project management application inspired by tools like Trello and Asana. This full-stack app allows users to create projects, assign tasks, leave comments, and collaborate in real time.

## Features

- User authentication with login and registration
- Create and manage group projects
- Organize tasks on project boards
- Assign tasks to team members
- Add comments and collaboration notes to tasks
- Real-time updates using WebSockets
- Clean, responsive, and professional UI

## Tech Stack

### Frontend

- React
- Vite
- Axios
- CSS

### Backend

- Node.js
- Express.js
- JWT Authentication
- WebSockets
- JSON file-based storage

## Project Structure

```text
project-management-tool/
├── client/           # React frontend
├── server/           # Express backend
├── package.json      # Root scripts
└── README.md         # Project documentation
```

## Installation

1. Clone the repository
2. Install dependencies:

```bash
npm install
```

3. Start the backend:

```bash
npm run server
```

4. Start the frontend in a separate terminal:

```bash
npm run client
```

5. Open the app in your browser:

```text
http://localhost:5173/
```

## Usage

- Register a new account or log in
- Create a new project
- Add tasks to the project board
- Assign users and update task status
- Leave comments on tasks

## Notes

- The backend currently uses a local JSON file for data storage.
- Real-time updates are enabled through WebSocket connections.

## License

This project is for educational and portfolio purposes.
