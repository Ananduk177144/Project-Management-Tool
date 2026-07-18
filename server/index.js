const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET || 'project-secret';
const DATA_FILE = path.join(__dirname, 'data', 'store.json');

const clients = new Set();

function ensureDataFile() {
  if (!fs.existsSync(DATA_FILE)) {
    fs.mkdirSync(path.dirname(DATA_FILE), { recursive: true });
    fs.writeFileSync(
      DATA_FILE,
      JSON.stringify({ users: [], projects: [], nextUserId: 1, nextProjectId: 1, nextTaskId: 1, nextCommentId: 1 }, null, 2)
    );
  }
}

function readStore() {
  ensureDataFile();
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeStore(store) {
  ensureDataFile();
  fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));
}

function createToken(user) {
  return jwt.sign({ id: user.id, name: user.name, email: user.email }, JWT_SECRET, { expiresIn: '7d' });
}

function authenticate(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ message: 'Authentication required.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid token.' });
  }
}

function broadcast(event, payload) {
  const message = JSON.stringify({ event, payload });
  clients.forEach((client) => {
    if (client.readyState === 1) {
      client.send(message);
    }
  });
}

wss.on('connection', (ws) => {
  clients.add(ws);
  ws.send(JSON.stringify({ event: 'connected', payload: { status: 'Live updates are on' } }));
  ws.on('close', () => clients.delete(ws));
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email and password are required.' });
  }

  const store = readStore();
  const existing = store.users.find((user) => user.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    return res.status(409).json({ message: 'Email already registered.' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const user = {
    id: store.nextUserId++,
    name,
    email: email.toLowerCase(),
    password: hashedPassword,
    createdAt: new Date().toISOString()
  };

  store.users.push(user);
  writeStore(store);

  const token = createToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ message: 'Email and password are required.' });
  }

  const store = readStore();
  const user = store.users.find((item) => item.email.toLowerCase() === email.toLowerCase());
  if (!user) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ message: 'Invalid credentials.' });
  }

  const token = createToken(user);
  res.json({ token, user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/auth/me', authenticate, (req, res) => {
  const store = readStore();
  const user = store.users.find((item) => item.id === req.user.id);
  if (!user) {
    return res.status(404).json({ message: 'User not found.' });
  }

  res.json({ user: { id: user.id, name: user.name, email: user.email } });
});

app.get('/api/users', authenticate, (req, res) => {
  const store = readStore();
  res.json(store.users.map(({ id, name, email }) => ({ id, name, email })));
});

app.get('/api/projects', authenticate, (req, res) => {
  const store = readStore();
  const projects = store.projects
    .filter((project) => project.members.includes(req.user.id) || project.ownerId === req.user.id)
    .map((project) => ({ ...project, taskCount: project.tasks.length }));
  res.json(projects);
});

app.post('/api/projects', authenticate, (req, res) => {
  const { name, description } = req.body;
  if (!name) {
    return res.status(400).json({ message: 'A project name is required.' });
  }

  const store = readStore();
  const project = {
    id: store.nextProjectId++,
    name,
    description: description || '',
    ownerId: req.user.id,
    members: [req.user.id],
    tasks: [],
    createdAt: new Date().toISOString()
  };

  store.projects.push(project);
  writeStore(store);
  broadcast('project:updated', project);
  res.status(201).json(project);
});

app.get('/api/projects/:id', authenticate, (req, res) => {
  const store = readStore();
  const project = store.projects.find((item) => item.id === Number(req.params.id));
  if (!project) {
    return res.status(404).json({ message: 'Project not found.' });
  }
  res.json(project);
});

app.post('/api/projects/:id/tasks', authenticate, (req, res) => {
  const { title, description, assigneeId, status } = req.body;
  if (!title) {
    return res.status(400).json({ message: 'A task title is required.' });
  }

  const store = readStore();
  const project = store.projects.find((item) => item.id === Number(req.params.id));
  if (!project) {
    return res.status(404).json({ message: 'Project not found.' });
  }

  const task = {
    id: store.nextTaskId++,
    title,
    description: description || '',
    status: status || 'backlog',
    assigneeId: assigneeId || null,
    comments: [],
    createdAt: new Date().toISOString()
  };

  project.tasks.push(task);
  writeStore(store);
  broadcast('task:updated', { projectId: project.id, task });
  res.status(201).json(task);
});

app.patch('/api/tasks/:taskId', authenticate, (req, res) => {
  const store = readStore();
  let taskFound = null;
  let projectFound = null;

  for (const project of store.projects) {
    const task = project.tasks.find((item) => item.id === Number(req.params.taskId));
    if (task) {
      taskFound = task;
      projectFound = project;
      break;
    }
  }

  if (!taskFound || !projectFound) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  const { title, description, assigneeId, status } = req.body;
  if (title !== undefined) taskFound.title = title;
  if (description !== undefined) taskFound.description = description;
  if (assigneeId !== undefined) taskFound.assigneeId = assigneeId;
  if (status !== undefined) taskFound.status = status;

  writeStore(store);
  broadcast('task:updated', { projectId: projectFound.id, task: taskFound });
  res.json(taskFound);
});

app.post('/api/tasks/:taskId/comments', authenticate, (req, res) => {
  const { text } = req.body;
  if (!text) {
    return res.status(400).json({ message: 'Comment text is required.' });
  }

  const store = readStore();
  let taskFound = null;
  let projectFound = null;

  for (const project of store.projects) {
    const task = project.tasks.find((item) => item.id === Number(req.params.taskId));
    if (task) {
      taskFound = task;
      projectFound = project;
      break;
    }
  }

  if (!taskFound || !projectFound) {
    return res.status(404).json({ message: 'Task not found.' });
  }

  const comment = {
    id: store.nextCommentId++,
    userId: req.user.id,
    userName: req.user.name,
    text,
    createdAt: new Date().toISOString()
  };

  taskFound.comments.push(comment);
  writeStore(store);
  broadcast('task:updated', { projectId: projectFound.id, task: taskFound });
  res.status(201).json(comment);
});

app.patch('/api/tasks/:taskId/comments/:commentId', authenticate, (req, res) => {
  const { text } = req.body;
  if (!text || !text.trim()) {
    return res.status(400).json({ message: 'Comment text is required.' });
  }

  const store = readStore();
  let taskFound = null;
  let projectFound = null;
  let commentFound = null;

  for (const project of store.projects) {
    const task = project.tasks.find((item) => item.id === Number(req.params.taskId));
    if (task) {
      taskFound = task;
      projectFound = project;
      commentFound = task.comments.find((item) => item.id === Number(req.params.commentId));
      break;
    }
  }

  if (!taskFound || !projectFound || !commentFound) {
    return res.status(404).json({ message: 'Comment not found.' });
  }

  if (commentFound.userId !== req.user.id) {
    return res.status(403).json({ message: 'You can only edit your own comments.' });
  }

  commentFound.text = text.trim();
  writeStore(store);
  broadcast('task:updated', { projectId: projectFound.id, task: taskFound });
  res.json(commentFound);
});

app.delete('/api/tasks/:taskId/comments/:commentId', authenticate, (req, res) => {
  const store = readStore();
  let taskFound = null;
  let projectFound = null;
  let commentIndex = -1;

  for (const project of store.projects) {
    const task = project.tasks.find((item) => item.id === Number(req.params.taskId));
    if (task) {
      taskFound = task;
      projectFound = project;
      commentIndex = task.comments.findIndex((item) => item.id === Number(req.params.commentId));
      break;
    }
  }

  if (!taskFound || !projectFound || commentIndex === -1) {
    return res.status(404).json({ message: 'Comment not found.' });
  }

  const comment = taskFound.comments[commentIndex];
  if (comment.userId !== req.user.id) {
    return res.status(403).json({ message: 'You can only delete your own comments.' });
  }

  taskFound.comments.splice(commentIndex, 1);
  writeStore(store);
  broadcast('task:updated', { projectId: projectFound.id, task: taskFound });
  res.status(204).send();
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
