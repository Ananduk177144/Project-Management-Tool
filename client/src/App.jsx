import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const API_URL = "http://localhost:5000/api";

function App() {
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState({
    name: "",
    email: "",
    password: "",
  });
  const [token, setToken] = useState(localStorage.getItem("pmt-token") || "");
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [selectedProjectId, setSelectedProjectId] = useState(null);
  const [projectForm, setProjectForm] = useState({ name: "", description: "" });
  const [taskForm, setTaskForm] = useState({
    title: "",
    description: "",
    assigneeId: "",
    status: "backlog",
  });
  const [commentText, setCommentText] = useState("");
  const [users, setUsers] = useState([]);
  const [message, setMessage] = useState("");
  const [live, setLive] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  useEffect(() => {
    if (!token) return;

    axios
      .get(`${API_URL}/auth/me`, { headers: authHeaders })
      .then(({ data }) => setUser(data.user))
      .catch(() => {
        localStorage.removeItem("pmt-token");
        setToken("");
      });

    axios
      .get(`${API_URL}/projects`, { headers: authHeaders })
      .then(({ data }) => {
        setProjects(data);
        if (!selectedProjectId && data[0]) setSelectedProjectId(data[0].id);
      });

    axios
      .get(`${API_URL}/users`, { headers: authHeaders })
      .then(({ data }) => setUsers(data));
  }, [token]);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket("ws://localhost:5000");
    ws.onopen = () => setLive(true);
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      if (data.event === "task:updated") {
        setProjects((prev) =>
          prev.map((project) =>
            project.id === data.payload.projectId
              ? {
                  ...project,
                  tasks: project.tasks.map((task) =>
                    task.id === data.payload.task.id ? data.payload.task : task,
                  ),
                }
              : project,
          ),
        );
      }
      if (data.event === "project:updated") {
        setProjects((prev) => [
          data.payload,
          ...prev.filter((project) => project.id !== data.payload.id),
        ]);
      }
    };
    ws.onclose = () => setLive(false);
    return () => ws.close();
  }, [token]);

  const currentProject =
    projects.find((project) => project.id === selectedProjectId) || null;

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    try {
      const endpoint = authMode === "login" ? "/auth/login" : "/auth/register";
      const response = await axios.post(`${API_URL}${endpoint}`, authForm);
      localStorage.setItem("pmt-token", response.data.token);
      setToken(response.data.token);
      setUser(response.data.user);
      setMessage(
        authMode === "login"
          ? "Welcome back!"
          : "Account created successfully!",
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "Authentication failed");
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const response = await axios.post(`${API_URL}/projects`, projectForm, {
        headers: authHeaders,
      });
      setProjects((prev) => [response.data, ...prev]);
      setSelectedProjectId(response.data.id);
      setProjectForm({ name: "", description: "" });
      setMessage("Project created successfully");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to create project");
    }
  };

  const handleCreateTask = async (e) => {
    e.preventDefault();
    if (!currentProject) return;
    try {
      const response = await axios.post(
        `${API_URL}/projects/${currentProject.id}/tasks`,
        taskForm,
        { headers: authHeaders },
      );
      setProjects((prev) =>
        prev.map((project) =>
          project.id === currentProject.id
            ? { ...project, tasks: [...(project.tasks || []), response.data] }
            : project,
        ),
      );
      setTaskForm({
        title: "",
        description: "",
        assigneeId: "",
        status: "backlog",
      });
      setMessage("Task added to board");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to add task");
    }
  };

  const handleStatusUpdate = async (taskId, status) => {
    try {
      await axios.patch(
        `${API_URL}/tasks/${taskId}`,
        { status },
        { headers: authHeaders },
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update task");
    }
  };

  const handleCommentAdd = async (taskId) => {
    const text = commentDrafts[taskId] || "";
    if (!text.trim()) {
      setMessage("Please enter a comment before posting.");
      return;
    }

    try {
      await axios.post(
        `${API_URL}/tasks/${taskId}/comments`,
        { text },
        { headers: authHeaders },
      );
      setCommentDrafts((prev) => ({ ...prev, [taskId]: "" }));
      setMessage("Comment posted");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to comment");
    }
  };

  const logout = () => {
    localStorage.removeItem("pmt-token");
    setToken("");
    setUser(null);
    setProjects([]);
    setSelectedProjectId(null);
  };

  if (!token || !user) {
    return (
      <div className="app-shell auth-shell">
        <div className="card auth-card">
          <h1>Project Management Tool</h1>
          <p>Collaborate, plan, and deliver projects smoothly.</p>
          <div className="toggle-row">
            <button
              className={authMode === "login" ? "active" : ""}
              onClick={() => setAuthMode("login")}
            >
              Login
            </button>
            <button
              className={authMode === "register" ? "active" : ""}
              onClick={() => setAuthMode("register")}
            >
              Register
            </button>
          </div>
          <form onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <input
                placeholder="Full name"
                value={authForm.name}
                onChange={(e) =>
                  setAuthForm({ ...authForm, name: e.target.value })
                }
              />
            )}
            <input
              type="email"
              placeholder="Email"
              value={authForm.email}
              onChange={(e) =>
                setAuthForm({ ...authForm, email: e.target.value })
              }
            />
            <input
              type="password"
              placeholder="Password"
              value={authForm.password}
              onChange={(e) =>
                setAuthForm({ ...authForm, password: e.target.value })
              }
            />
            <button type="submit">
              {authMode === "login" ? "Sign in" : "Create account"}
            </button>
          </form>
          {message && <p className="status">{message}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell dashboard-shell">
      <aside className="sidebar">
        <div>
          <h2>PM Tool</h2>
          <p>Welcome, {user.name}</p>
          <div className="status-pill">
            {live ? "Live updates on" : "Connecting..."}
          </div>
        </div>
        <div className="section-block">
          <h3>Create Project</h3>
          <form onSubmit={handleCreateProject}>
            <input
              placeholder="Project name"
              value={projectForm.name}
              onChange={(e) =>
                setProjectForm({ ...projectForm, name: e.target.value })
              }
            />
            <textarea
              placeholder="Brief description"
              value={projectForm.description}
              onChange={(e) =>
                setProjectForm({ ...projectForm, description: e.target.value })
              }
            />
            <button type="submit">Create</button>
          </form>
        </div>
        <div className="section-block">
          <h3>Your Projects</h3>
          {projects.map((project) => (
            <button
              key={project.id}
              className={`project-item ${selectedProjectId === project.id ? "selected" : ""}`}
              onClick={() => setSelectedProjectId(project.id)}
            >
              <strong>{project.name}</strong>
              <span>{project.tasks?.length || 0} tasks</span>
            </button>
          ))}
        </div>
        <button className="logout" onClick={logout}>
          Logout
        </button>
      </aside>

      <main className="main-content">
        {currentProject ? (
          <>
            <header className="hero-card">
              <div>
                <h1>{currentProject.name}</h1>
                <p>
                  {currentProject.description ||
                    "A collaborative workspace for your team."}
                </p>
              </div>
              <div className="hero-stats">
                <div>
                  <strong>{currentProject.tasks?.length || 0}</strong>
                  <span>Tasks</span>
                </div>
                <div>
                  <strong>{users.length}</strong>
                  <span>Members</span>
                </div>
              </div>
            </header>

            <section className="section-block">
              <h3>Add Task</h3>
              <form className="task-form" onSubmit={handleCreateTask}>
                <input
                  placeholder="Task title"
                  value={taskForm.title}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, title: e.target.value })
                  }
                />
                <input
                  placeholder="Task details"
                  value={taskForm.description}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, description: e.target.value })
                  }
                />
                <select
                  value={taskForm.assigneeId}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, assigneeId: e.target.value })
                  }
                >
                  <option value="">Unassigned</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
                <select
                  value={taskForm.status}
                  onChange={(e) =>
                    setTaskForm({ ...taskForm, status: e.target.value })
                  }
                >
                  <option value="backlog">Backlog</option>
                  <option value="inprogress">In Progress</option>
                  <option value="review">Review</option>
                  <option value="done">Done</option>
                </select>
                <button type="submit">Add Task</button>
              </form>
            </section>

            <section className="kanban-grid">
              {["backlog", "inprogress", "review", "done"].map((status) => (
                <div key={status} className="kanban-column">
                  <h3>
                    {status.replace(/(^\w|\s+\w)/g, (c) => c.toUpperCase())}
                  </h3>
                  {(currentProject.tasks || [])
                    .filter((task) => task.status === status)
                    .map((task) => (
                      <div key={task.id} className="task-card">
                        <h4>{task.title}</h4>
                        <p>{task.description}</p>
                        <div className="task-meta">
                          <span>
                            {users.find((u) => u.id === task.assigneeId)
                              ?.name || "Unassigned"}
                          </span>
                          <select
                            value={task.status}
                            onChange={(e) =>
                              handleStatusUpdate(task.id, e.target.value)
                            }
                          >
                            <option value="backlog">Backlog</option>
                            <option value="inprogress">In Progress</option>
                            <option value="review">Review</option>
                            <option value="done">Done</option>
                          </select>
                        </div>
                        <div className="comments-box">
                          <h5>Comments</h5>
                          {(task.comments || []).map((comment) => (
                            <div key={comment.id} className="comment-item">
                              <strong>{comment.userName}</strong>
                              <p>{comment.text}</p>
                            </div>
                          ))}
                          <textarea
                            placeholder="Write a comment"
                            value={commentDrafts[task.id] || ""}
                            onChange={(e) =>
                              setCommentDrafts((prev) => ({
                                ...prev,
                                [task.id]: e.target.value,
                              }))
                            }
                          />
                          <button onClick={() => handleCommentAdd(task.id)}>
                            Post
                          </button>
                        </div>
                      </div>
                    ))}
                </div>
              ))}
            </section>
          </>
        ) : (
          <div className="empty-state">
            Create a project to start planning your work.
          </div>
        )}
        {message && <p className="status">{message}</p>}
      </main>
    </div>
  );
}

export default App;
