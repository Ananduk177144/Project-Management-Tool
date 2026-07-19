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
  const [isMessageVisible, setIsMessageVisible] = useState(false);
  const [live, setLive] = useState(false);
  const [commentDrafts, setCommentDrafts] = useState({});
  const [editingCommentId, setEditingCommentId] = useState(null);
  const [commentEditText, setCommentEditText] = useState("");

  const authHeaders = useMemo(
    () => ({ Authorization: `Bearer ${token}` }),
    [token],
  );

  useEffect(() => {
    if (!message) {
      setIsMessageVisible(false);
      return;
    }

    setIsMessageVisible(true);
    const timer = window.setTimeout(() => {
      setIsMessageVisible(false);
    }, 4500);

    const clearTimer = window.setTimeout(() => {
      setMessage("");
    }, 5000);

    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearTimer);
    };
  }, [message]);

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

  const statusCounts = useMemo(() => {
    const counts = { backlog: 0, inprogress: 0, review: 0, done: 0 };
    (currentProject?.tasks || []).forEach((task) => {
      if (counts[task.status] !== undefined) {
        counts[task.status] += 1;
      }
    });
    return counts;
  }, [currentProject]);

  const completionPercent =
    currentProject?.tasks?.length > 0
      ? Math.round((statusCounts.done / currentProject.tasks.length) * 100)
      : 0;

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
      const response = await axios.patch(
        `${API_URL}/tasks/${taskId}`,
        { status },
        { headers: authHeaders },
      );

      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          tasks: (project.tasks || []).map((task) =>
            task.id === taskId ? response.data : task,
          ),
        })),
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update task");
    }
  };

  const handleAssigneeUpdate = async (taskId, assigneeId) => {
    try {
      const response = await axios.patch(
        `${API_URL}/tasks/${taskId}`,
        { assigneeId },
        { headers: authHeaders },
      );

      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          tasks: (project.tasks || []).map((task) =>
            task.id === taskId ? response.data : task,
          ),
        })),
      );
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update assignee");
    }
  };

  const handleCommentAdd = async (taskId) => {
    const text = commentDrafts[taskId] || "";
    if (!text.trim()) {
      setMessage("Please enter a comment before posting.");
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/tasks/${taskId}/comments`,
        { text },
        { headers: authHeaders },
      );

      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          tasks: (project.tasks || []).map((task) =>
            task.id === taskId
              ? { ...task, comments: [...(task.comments || []), response.data] }
              : task,
          ),
        })),
      );
      setCommentDrafts((prev) => ({ ...prev, [taskId]: "" }));
      setMessage("Comment posted");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to comment");
    }
  };

  const handleCommentEdit = async (taskId, commentId) => {
    const text = commentEditText.trim();
    if (!text) {
      setMessage("Please enter a comment before saving.");
      return;
    }

    try {
      const response = await axios.patch(
        `${API_URL}/tasks/${taskId}/comments/${commentId}`,
        { text },
        { headers: authHeaders },
      );

      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          tasks: (project.tasks || []).map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  comments: (task.comments || []).map((comment) =>
                    comment.id === commentId ? response.data : comment,
                  ),
                }
              : task,
          ),
        })),
      );
      setEditingCommentId(null);
      setCommentEditText("");
      setMessage("Comment updated");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to update comment");
    }
  };

  const handleCommentDelete = async (taskId, commentId) => {
    if (!window.confirm("Delete this comment?")) return;

    try {
      await axios.delete(
        `${API_URL}/tasks/${taskId}/comments/${commentId}`,
        { headers: authHeaders },
      );

      setProjects((prev) =>
        prev.map((project) => ({
          ...project,
          tasks: (project.tasks || []).map((task) =>
            task.id === taskId
              ? {
                  ...task,
                  comments: (task.comments || []).filter(
                    (comment) => comment.id !== commentId,
                  ),
                }
              : task,
          ),
        })),
      );
      setEditingCommentId(null);
      setCommentEditText("");
      setMessage("Comment deleted");
    } catch (error) {
      setMessage(error.response?.data?.message || "Unable to delete comment");
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
          {message && (
            <p className={`status ${isMessageVisible ? "visible" : "hidden"}`}>
              {message}
            </p>
          )}
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
              <div className="hero-copy">
                <div className="hero-badges">
                  <span className="hero-badge accent">⚡ Focus mode</span>
                  <span className={`hero-badge ${live ? "live" : "pending"}`}>
                    {live ? "Live updates on" : "Connecting…"}
                  </span>
                </div>
                <h1>{currentProject.name}</h1>
                <p>
                  {currentProject.description ||
                    "A collaborative workspace for your team."}
                </p>
              </div>
              <div className="hero-side-stack">
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
                <div className="hero-progress-panel">
                  <div className="progress-top">
                    <span>Completion</span>
                    <strong>{completionPercent}%</strong>
                  </div>
                  <div className="progress-track">
                    <div
                      className="progress-fill"
                      style={{ width: `${completionPercent}%` }}
                    />
                  </div>
                  <div className="progress-caption">
                    {statusCounts.done} done • {statusCounts.inprogress} active
                  </div>
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
                  className="task-form-select"
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
                  className="task-form-select"
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
                      <div key={task.id} className={`task-card ${task.status}`}>
                        <h4>{task.title}</h4>
                        <p>{task.description}</p>
                        <div className="task-meta">
                          <div>
                            <label>Assignee</label>
                            <select
                              value={task.assigneeId || ""}
                              onChange={(e) =>
                                handleAssigneeUpdate(task.id, e.target.value)
                              }
                            >
                              <option value="">Unassigned</option>
                              {users.map((u) => (
                                <option key={u.id} value={u.id}>
                                  {u.name}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label>Status</label>
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
                        </div>
                        <div className="comments-box">
                          <h5>Comments</h5>
                          {(task.comments || []).map((comment) => (
                            <div key={comment.id} className="comment-item">
                              <div className="comment-header">
                                <strong>{comment.userName}</strong>
                                {user && comment.userId === user.id && (
                                  <div className="comment-actions">
                                    <button
                                      className="comment-action-btn"
                                      onClick={() => {
                                        setEditingCommentId(comment.id);
                                        setCommentEditText(comment.text);
                                      }}
                                    >
                                      Edit
                                    </button>
                                    <button
                                      className="comment-action-btn delete"
                                      onClick={() =>
                                        handleCommentDelete(task.id, comment.id)
                                      }
                                    >
                                      Delete
                                    </button>
                                  </div>
                                )}
                              </div>
                              {editingCommentId === comment.id ? (
                                <>
                                  <textarea
                                    value={commentEditText}
                                    onChange={(e) =>
                                      setCommentEditText(e.target.value)
                                    }
                                  />
                                  <div className="comment-action-row">
                                    <button
                                      onClick={() =>
                                        handleCommentEdit(task.id, comment.id)
                                      }
                                    >
                                      Save
                                    </button>
                                    <button
                                      className="comment-action-btn"
                                      onClick={() => {
                                        setEditingCommentId(null);
                                        setCommentEditText("");
                                      }}
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                </>
                              ) : (
                                <p>{comment.text}</p>
                              )}
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
        {message && (
          <p className={`status ${isMessageVisible ? "visible" : "hidden"}`}>
            {message}
          </p>
        )}
      </main>
    </div>
  );
}

export default App;
