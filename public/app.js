const state = {
  tasks: [],
  filter: "all",
  loading: false
};

const elements = {
  form: document.getElementById("task-form"),
  titleInput: document.getElementById("title"),
  submitButton: document.getElementById("submit-button"),
  formMessage: document.getElementById("form-message"),
  listMessage: document.getElementById("list-message"),
  loadingState: document.getElementById("loading-state"),
  taskList: document.getElementById("task-list"),
  refreshButton: document.getElementById("refresh-button"),
  filterButtons: Array.from(document.querySelectorAll(".filter-button")),
  taskTemplate: document.getElementById("task-item-template")
};

function setMessage(target, message, type = "") {
  target.textContent = message;
  target.className = "status-message";
  if (type) {
    target.classList.add(type);
  }
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short"
  }).format(new Date(dateString));
}

function getVisibleTasks() {
  if (state.filter === "active") {
    return state.tasks.filter((task) => !task.completed);
  }

  if (state.filter === "completed") {
    return state.tasks.filter((task) => task.completed);
  }

  return state.tasks;
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  elements.taskList.innerHTML = "";

  if (!visibleTasks.length) {
    const emptyState = document.createElement("li");
    emptyState.className = "empty-state";
    emptyState.textContent =
      state.tasks.length === 0
        ? "No tasks yet. Add your first one above."
        : "No tasks match the selected filter.";
    elements.taskList.appendChild(emptyState);
    return;
  }

  for (const task of visibleTasks) {
    const fragment = elements.taskTemplate.content.cloneNode(true);
    const item = fragment.querySelector(".task-item");
    const checkbox = fragment.querySelector(".task-checkbox");
    const title = fragment.querySelector(".task-title");
    const meta = fragment.querySelector(".task-meta");
    const deleteButton = fragment.querySelector(".task-delete");

    item.dataset.id = task.id;
    item.classList.toggle("completed", task.completed);
    checkbox.checked = task.completed;
    checkbox.setAttribute("aria-label", `Mark "${task.title}" as completed`);
    title.textContent = task.title;
    meta.textContent = `Created ${formatDate(task.createdAt)}`;

    checkbox.addEventListener("change", () => updateTask(task.id, {
      completed: checkbox.checked
    }));

    deleteButton.addEventListener("click", () => deleteTask(task.id));

    elements.taskList.appendChild(fragment);
  }
}

function setLoading(isLoading) {
  state.loading = isLoading;
  elements.loadingState.hidden = !isLoading;
  elements.refreshButton.disabled = isLoading;
  elements.submitButton.disabled = isLoading;
}

async function request(url, options = {}) {
  const response = await fetch(url, {
    headers: {
      "Content-Type": "application/json"
    },
    ...options
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || "Something went wrong.");
  }

  return payload;
}

async function loadTasks() {
  setLoading(true);
  setMessage(elements.listMessage, "");

  try {
    const payload = await request("/tasks");
    state.tasks = payload.tasks || [];
    renderTasks();
  } catch (error) {
    setMessage(elements.listMessage, error.message, "error");
  } finally {
    setLoading(false);
  }
}

async function createTask(title) {
  elements.submitButton.disabled = true;
  setMessage(elements.formMessage, "");

  try {
    const payload = await request("/tasks", {
      method: "POST",
      body: JSON.stringify({ title })
    });

    state.tasks.unshift(payload.task);
    renderTasks();
    elements.form.reset();
    setMessage(elements.formMessage, payload.message, "success");
  } catch (error) {
    setMessage(elements.formMessage, error.message, "error");
  } finally {
    elements.submitButton.disabled = false;
    elements.titleInput.focus();
  }
}

async function updateTask(taskId, updates) {
  setMessage(elements.listMessage, "");

  try {
    const payload = await request(`/tasks/${taskId}`, {
      method: "PATCH",
      body: JSON.stringify(updates)
    });

    state.tasks = state.tasks.map((task) =>
      task.id === taskId ? payload.task : task
    );
    renderTasks();
  } catch (error) {
    setMessage(elements.listMessage, error.message, "error");
    await loadTasks();
  }
}

async function deleteTask(taskId) {
  setMessage(elements.listMessage, "");

  try {
    await request(`/tasks/${taskId}`, { method: "DELETE" });
    state.tasks = state.tasks.filter((task) => task.id !== taskId);
    renderTasks();
    setMessage(elements.listMessage, "Task deleted successfully.", "success");
  } catch (error) {
    setMessage(elements.listMessage, error.message, "error");
  }
}

elements.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const title = elements.titleInput.value.trim();

  if (!title) {
    setMessage(elements.formMessage, "Please enter a task title.", "error");
    return;
  }

  await createTask(title);
});

elements.refreshButton.addEventListener("click", loadTasks);

for (const button of elements.filterButtons) {
  button.addEventListener("click", () => {
    state.filter = button.dataset.filter;
    for (const filterButton of elements.filterButtons) {
      filterButton.classList.toggle("active", filterButton === button);
    }
    renderTasks();
  });
}

loadTasks();
