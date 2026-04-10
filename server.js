const http = require("http");
const fs = require("fs");
const path = require("path");
const { randomUUID } = require("crypto");

const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || "127.0.0.1";
const PUBLIC_DIR = path.join(__dirname, "public");
const DATA_DIR = path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "tasks.json");

let tasks = loadTasks();

function loadTasks() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    if (!fs.existsSync(DATA_FILE)) {
      fs.writeFileSync(DATA_FILE, "[]", "utf8");
      return [];
    }

    const file = fs.readFileSync(DATA_FILE, "utf8");
    const parsed = JSON.parse(file);
    return Array.isArray(parsed) ? parsed : [];
  } catch (error) {
    console.error("Failed to load tasks:", error);
    return [];
  }
}

function saveTasks() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(tasks, null, 2), "utf8");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  response.end(JSON.stringify(payload));
}

function sendFile(response, filePath) {
  const extension = path.extname(filePath);
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8"
  };

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if (error.code === "ENOENT") {
        sendJson(response, 404, { error: "File not found." });
        return;
      }

      sendJson(response, 500, { error: "Unable to read file." });
      return;
    }

    response.writeHead(200, {
      "Content-Type": contentTypes[extension] || "application/octet-stream"
    });
    response.end(content);
  });
}

function parseBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;

      if (body.length > 1e6) {
        request.destroy();
        reject(new Error("Request body too large."));
      }
    });

    request.on("end", () => {
      if (!body) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON body."));
      }
    });

    request.on("error", reject);
  });
}

function validateTaskTitle(title) {
  if (typeof title !== "string") {
    return "Title is required and must be a string.";
  }

  const trimmed = title.trim();
  if (!trimmed) {
    return "Title cannot be empty.";
  }

  if (trimmed.length > 120) {
    return "Title must be 120 characters or fewer.";
  }

  return null;
}

function validateCompleted(completed) {
  if (typeof completed !== "boolean") {
    return "Completed must be a boolean.";
  }

  return null;
}

function getTaskIdFromPath(urlPath) {
  const match = urlPath.match(/^\/tasks\/([^/]+)$/);
  return match ? match[1] : null;
}

function sortTasks(list) {
  return [...list].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

async function handleApi(request, response, urlPath) {
  if (request.method === "GET" && urlPath === "/tasks") {
    sendJson(response, 200, { tasks: sortTasks(tasks) });
    return true;
  }

  if (request.method === "POST" && urlPath === "/tasks") {
    try {
      const body = await parseBody(request);
      const titleError = validateTaskTitle(body.title);

      if (titleError) {
        sendJson(response, 400, { error: titleError });
        return true;
      }

      const task = {
        id: randomUUID(),
        title: body.title.trim(),
        completed: false,
        createdAt: new Date().toISOString()
      };

      tasks.unshift(task);
      saveTasks();
      sendJson(response, 201, { message: "Task created successfully.", task });
      return true;
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Unable to create task." });
      return true;
    }
  }

  const taskId = getTaskIdFromPath(urlPath);
  if (!taskId) {
    return false;
  }

  const taskIndex = tasks.findIndex((task) => task.id === taskId);
  if (taskIndex === -1) {
    sendJson(response, 404, { error: "Task not found." });
    return true;
  }

  if (request.method === "PATCH") {
    try {
      const body = await parseBody(request);
      const updates = {};

      if (Object.prototype.hasOwnProperty.call(body, "completed")) {
        const completedError = validateCompleted(body.completed);
        if (completedError) {
          sendJson(response, 400, { error: completedError });
          return true;
        }
        updates.completed = body.completed;
      }

      if (Object.prototype.hasOwnProperty.call(body, "title")) {
        const titleError = validateTaskTitle(body.title);
        if (titleError) {
          sendJson(response, 400, { error: titleError });
          return true;
        }
        updates.title = body.title.trim();
      }

      if (Object.keys(updates).length === 0) {
        sendJson(response, 400, {
          error: "Provide at least one valid field to update."
        });
        return true;
      }

      tasks[taskIndex] = { ...tasks[taskIndex], ...updates };
      saveTasks();
      sendJson(response, 200, {
        message: "Task updated successfully.",
        task: tasks[taskIndex]
      });
      return true;
    } catch (error) {
      sendJson(response, 400, { error: error.message || "Unable to update task." });
      return true;
    }
  }

  if (request.method === "DELETE") {
    const deletedTask = tasks[taskIndex];
    tasks.splice(taskIndex, 1);
    saveTasks();
    sendJson(response, 200, {
      message: "Task deleted successfully.",
      task: deletedTask
    });
    return true;
  }

  sendJson(response, 405, { error: "Method not allowed." });
  return true;
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  const urlPath = url.pathname;

  if (urlPath.startsWith("/tasks")) {
    try {
      const handled = await handleApi(request, response, urlPath);
      if (!handled) {
        sendJson(response, 404, { error: "Route not found." });
      }
    } catch (error) {
      console.error("Unexpected server error:", error);
      sendJson(response, 500, { error: "Internal server error." });
    }
    return;
  }

  const requestedPath = urlPath === "/" ? "index.html" : urlPath.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, requestedPath);

  if (!filePath.startsWith(PUBLIC_DIR)) {
    sendJson(response, 403, { error: "Forbidden." });
    return;
  }

  sendFile(response, filePath);
});

server.listen(PORT, HOST, () => {
  console.log(`Task Manager running at http://${HOST}:${PORT}`);
});
