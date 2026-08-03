/* CoursyLand Admin — Main JS */

// ===== CSRF TOKEN =====
// הטוקן מוזרק מה-PHP דרך meta tag
function getCsrfToken() {
  return document.querySelector('meta[name="csrf-token"]')?.content || '';
}

// ===== TOAST =====
function showToast(msg, type = 'success') {
  let container = document.querySelector('.toast-container');
  if (!container) {
    container = document.createElement('div');
    container.className = 'toast-container';
    document.body.appendChild(container);
  }
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

// ===== MODAL =====
function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}
function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

document.addEventListener('click', e => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('open');
  }
  if (e.target.classList.contains('modal-close')) {
    e.target.closest('.modal-overlay')?.classList.remove('open');
  }
});

// ===== PASSWORD TOGGLE =====
document.querySelectorAll('[data-toggle-password]').forEach(btn => {
  btn.addEventListener('click', () => {
    const input = document.getElementById(btn.dataset.togglePassword);
    if (!input) return;
    const isText = input.type === 'text';
    input.type = isText ? 'password' : 'text';
    btn.innerHTML = isText
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21"/></svg>`;
  });
});

// ===== CONFIRM DELETE =====
document.querySelectorAll('[data-confirm]').forEach(btn => {
  btn.addEventListener('click', e => {
    if (!confirm(btn.dataset.confirm || 'האם אתה בטוח?')) {
      e.preventDefault();
    }
  });
});

// ===== AUTO-DISMISS FLASH =====
document.querySelectorAll('.alert[data-auto-dismiss]').forEach(el => {
  setTimeout(() => el.remove(), 4000);
});

// ===== DEPENDENT DROPDOWN (client → course) =====
const clientSelect = document.getElementById('filter-client');
const courseSelect = document.getElementById('filter-course');
if (clientSelect && courseSelect) {
  clientSelect.addEventListener('change', async () => {
    const clientId = clientSelect.value;
    courseSelect.innerHTML = '<option value="">כל הקורסים</option>';
    if (!clientId) return;
    const res = await fetch(`/admin/api/courses_by_client.php?client_id=${clientId}`);
    const courses = await res.json();
    courses.forEach(c => {
      const opt = document.createElement('option');
      opt.value = c.id;
      opt.textContent = c.name;
      courseSelect.appendChild(opt);
    });
  });
}

// ===== PAID CHECKBOX (AJAX + CSRF) =====
document.querySelectorAll('.paid-checkbox').forEach(cb => {
  cb.addEventListener('change', async () => {
    const reportId = cb.dataset.reportId;
    const isPaid   = cb.checked ? 1 : 0;
    const res = await fetch('/admin/api/mark_paid.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `report_id=${reportId}&is_paid=${isPaid}&csrf_token=${encodeURIComponent(getCsrfToken())}`,
    });
    const data = await res.json();
    showToast(data.message, data.success ? 'success' : 'error');
  });
});
