export function showToast(message) {
  const root = document.querySelector("[data-toast-root]");
  if (!root) {
    return;
  }

  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  root.append(toast);

  window.setTimeout(() => {
    toast.classList.add("toast--visible");
  }, 20);

  window.setTimeout(() => {
    toast.classList.remove("toast--visible");
    window.setTimeout(() => toast.remove(), 200);
  }, 2600);
}
