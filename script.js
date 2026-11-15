// LaundryLink – simple client-side job board using localStorage

const STORAGE_KEY = 'laundrylink_jobs';

// ----- Helpers -----
function loadJobs() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveJobs(jobs) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(jobs));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
}

function formatDate(dateStr) {
  if (!dateStr) return 'Flexible';
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
}

// ----- DOM refs -----
const form = document.getElementById('request-form');
const successMsg = document.getElementById('success-message');
const jobsList = document.getElementById('jobs-list');
const noJobs = document.getElementById('no-jobs');
const refreshBtn = document.getElementById('refresh-jobs');
const modal = document.getElementById('claim-modal');
const modalSummary = document.getElementById('modal-job-summary');
const claimerName = document.getElementById('claimer-name');
const claimerPhone = document.getElementById('claimer-phone');
const confirmClaimBtn = document.getElementById('confirm-claim');
const totalRequestsEl = document.getElementById('total-requests');
const openCountEl = document.getElementById('open-count');
const claimedCountEl = document.getElementById('claimed-count');

let currentClaimId = null;

// ----- Render jobs -----
function renderJobs() {
  const jobs = loadJobs();
  const openJobs = jobs.filter(j => j.status === 'open');
  const claimedJobs = jobs.filter(j => j.status === 'claimed');

  // Stats
  totalRequestsEl.textContent = jobs.length;
  openCountEl.textContent = openJobs.length;
  claimedCountEl.textContent = claimedJobs.length;

  jobsList.innerHTML = '';

  if (jobs.length === 0) {
    noJobs.classList.remove('hidden');
    return;
  }

  noJobs.classList.add('hidden');

  // Show open jobs first, then claimed
  const sorted = [...openJobs, ...claimedJobs];

  sorted.forEach(job => {
    const card = document.createElement('article');
    card.className = `job-card ${job.status === 'claimed' ? 'claimed' : ''}`;
    card.dataset.id = job.id;

    const badgeClass = job.status === 'open' ? 'badge-open' : 'badge-claimed';
    const badgeText = job.status === 'open' ? 'Open' : 'Claimed';

    let actionsHtml = '';
    if (job.status === 'open') {
      actionsHtml = `
        <div class="job-actions">
          <button class="btn btn-primary btn-sm claim-btn" data-id="${job.id}">Claim this job</button>
        </div>
      `;
    } else {
      actionsHtml = `
        <div class="job-actions">
          <span style="font-size:0.85rem;color:var(--text-muted);">
            Claimed by ${job.claimerName || 'someone'} 
            ${job.claimerPhone ? `· ${job.claimerPhone}` : ''}
          </span>
        </div>
      `;
    }

    card.innerHTML = `
      <span class="job-badge ${badgeClass}">${badgeText}</span>
      <h3>${job.service}</h3>
      <div class="job-meta">
        ${formatDate(job.date)} · ${job.time || 'Flexible'}
      </div>
      <div class="job-details">
        <p><strong>Location:</strong> ${escapeHtml(job.address)}</p>
        <p><strong>Customer:</strong> ${escapeHtml(job.name)} · ${escapeHtml(job.phone)}</p>
        ${job.bags ? `<p><strong>Volume:</strong> ${escapeHtml(job.bags)}</p>` : ''}
        ${job.notes ? `<p><strong>Notes:</strong> ${escapeHtml(job.notes)}</p>` : ''}
      </div>
      ${actionsHtml}
    `;

    jobsList.appendChild(card);
  });

  // Attach claim listeners
  document.querySelectorAll('.claim-btn').forEach(btn => {
    btn.addEventListener('click', () => openClaimModal(btn.dataset.id));
  });
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&')
    .replace(/</g, '<')
    .replace(/>/g, '>')
    .replace(/"/g, '"');
}

// ----- Form submit -----
form.addEventListener('submit', (e) => {
  e.preventDefault();

  const job = {
    id: generateId(),
    name: form.name.value.trim(),
    phone: form.phone.value.trim(),
    address: form.address.value.trim(),
    service: form.service.value,
    bags: form.bags.value.trim(),
    date: form.date.value,
    time: form.time.value,
    notes: form.notes.value.trim(),
    status: 'open',
    createdAt: new Date().toISOString(),
    claimerName: null,
    claimerPhone: null
  };

  const jobs = loadJobs();
  jobs.unshift(job);
  saveJobs(jobs);

  form.reset();
  form.classList.add('hidden');
  successMsg.classList.remove('hidden');

  renderJobs();

  // Scroll to success
  successMsg.scrollIntoView({ behavior: 'smooth', block: 'center' });
});

// ----- Claim modal -----
function openClaimModal(jobId) {
  const jobs = loadJobs();
  const job = jobs.find(j => j.id === jobId);
  if (!job || job.status !== 'open') return;

  currentClaimId = jobId;
  modalSummary.innerHTML = `
    <strong>${escapeHtml(job.service)}</strong><br>
    ${escapeHtml(job.address)}<br>
    ${formatDate(job.date)} · ${escapeHtml(job.time || 'Flexible')}
  `;
  claimerName.value = '';
  claimerPhone.value = '';
  modal.classList.remove('hidden');
  claimerName.focus();
}

function closeModal() {
  modal.classList.add('hidden');
  currentClaimId = null;
}

document.querySelector('.modal-close').addEventListener('click', closeModal);
document.querySelector('.modal-cancel').addEventListener('click', closeModal);

modal.addEventListener('click', (e) => {
  if (e.target === modal) closeModal();
});

confirmClaimBtn.addEventListener('click', () => {
  if (!currentClaimId) return;

  const name = claimerName.value.trim();
  const phone = claimerPhone.value.trim();

  if (!name) {
    claimerName.focus();
    return;
  }

  const jobs = loadJobs();
  const idx = jobs.findIndex(j => j.id === currentClaimId);
  if (idx === -1) return;

  jobs[idx].status = 'claimed';
  jobs[idx].claimerName = name;
  jobs[idx].claimerPhone = phone || null;
  jobs[idx].claimedAt = new Date().toISOString();

  saveJobs(jobs);
  closeModal();
  renderJobs();
});

// ----- Refresh & init -----
refreshBtn.addEventListener('click', renderJobs);

// Mobile nav
const navToggle = document.querySelector('.nav-toggle');
const navLinks = document.querySelector('.nav-links');
navToggle?.addEventListener('click', () => {
  navLinks.classList.toggle('open');
});

// Close mobile nav on link click
navLinks?.querySelectorAll('a').forEach(link => {
  link.addEventListener('click', () => navLinks.classList.remove('open'));
});

// Set min date to today
const dateInput = document.getElementById('date');
if (dateInput) {
  const today = new Date().toISOString().split('T')[0];
  dateInput.min = today;
  dateInput.value = today;
}

// Initial render
renderJobs();

// Seed a couple of demo jobs if empty (only on first visit)
function seedDemoJobs() {
  const jobs = loadJobs();
  if (jobs.length > 0) return;

  const demos = [
    {
      id: generateId(),
      name: 'Alex Rivera',
      phone: '+1 555 0101',
      address: '42 Oak Street, Apt 3, Downtown',
      service: 'Wash & Fold',
      bags: '2 large bags',
      date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
      time: 'Afternoon (12pm–5pm)',
      notes: 'Please ring the doorbell. Detergent is under the sink.',
      status: 'open',
      createdAt: new Date().toISOString(),
      claimerName: null,
      claimerPhone: null
    },
    {
      id: generateId(),
      name: 'Sam Patel',
      phone: '+1 555 0202',
      address: '18 River Road, Unit B',
      service: 'Wash, Dry & Iron',
      bags: '1 bag + 3 dress shirts',
      date: new Date(Date.now() + 172800000).toISOString().split('T')[0],
      time: 'Morning (8am–12pm)',
      notes: 'Shirts need to be ready for work Monday.',
      status: 'open',
      createdAt: new Date().toISOString(),
      claimerName: null,
      claimerPhone: null
    }
  ];

  saveJobs(demos);
  renderJobs();
}

seedDemoJobs();
