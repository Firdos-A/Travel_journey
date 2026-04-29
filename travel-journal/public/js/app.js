'use strict';

const State = {
  session: null,
  entries: [],
  journals: [],
  filteredMood: '',
  searchQuery: '',
  leafletMap: null,
  leafletMarkers: [],
  pickerMap: null,
  pickerMarker: null,
  entryPhotosBase64: [],
  defaultJournalId: '',
  previousPage: 'home'
};

const $ = id => document.getElementById(id);
const $$ = sel => [...document.querySelectorAll(sel)];

const MOOD_EMOJI = { amazing: '*', happy: ':)', neutral: ':|', tired: 'zzz', difficult: '!' };
const COUNTRY_COORDS = {
  japan: [36.2048, 138.2529], france: [46.2276, 2.2137], italy: [41.8719, 12.5674],
  thailand: [15.87, 100.9925], india: [20.5937, 78.9629], usa: [37.0902, -95.7129],
  united_states: [37.0902, -95.7129], brazil: [-14.235, -51.9253], morocco: [31.7917, -7.0926],
  peru: [-9.19, -75.0152], greece: [39.0742, 21.8243], turkey: [38.9637, 35.2433],
  spain: [40.4637, -3.7492], mexico: [23.6345, -102.5528], germany: [51.1657, 10.4515],
  uk: [55.3781, -3.436], united_kingdom: [55.3781, -3.436], argentina: [-38.4161, -63.6167],
  australia: [-25.2744, 133.7751], china: [35.8617, 104.1954], canada: [56.1304, -106.3468],
  egypt: [26.8206, 30.8025], indonesia: [-0.7893, 113.9213], portugal: [39.3999, -8.2245],
  netherlands: [52.1326, 5.2913], sweden: [60.1282, 18.6435], norway: [60.472, 8.4689],
  switzerland: [46.8182, 8.2275], south_africa: [-30.5595, 22.9375], kenya: [-0.0236, 37.9062],
  vietnam: [14.0583, 108.2772], cambodia: [12.5657, 104.991]
};

function toast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(el._t);
  el._t = setTimeout(() => { el.className = 'toast'; }, 3000);
}

function escapeHtml(value = '') {
  return String(value).replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
  }[char]));
}

function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function countryToCoords(country) {
  const key = (country || '').toLowerCase().trim().replace(/\s+/g, '_');
  return COUNTRY_COORDS[key] || null;
}

function entryCoords(entry) {
  const lat = Number(entry.latitude);
  const lng = Number(entry.longitude);
  if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
  return countryToCoords(entry.country);
}

function entryPhotos(entry) {
  const photos = (entry.photos || [])
    .slice()
    .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''))
    .map(photo => photo.url || photo.image_url)
    .filter(Boolean);
  if (!photos.length && entry.cover_image) photos.push(entry.cover_image);
  return photos;
}

function journalEntryCount(journal) {
  const entries = journal.entries;
  if (Array.isArray(entries)) return Number(entries[0]?.count ?? entries.length) || 0;
  if (typeof entries === 'number') return entries;
  return 0;
}

function sortedEntries(entries = []) {
  return entries.slice().sort((a, b) => {
    const aDate = a.travel_date || a.created_at || '';
    const bDate = b.travel_date || b.created_at || '';
    return bDate.localeCompare(aDate);
  });
}

function showAuth() {
  $('authScreen').style.display = '';
  $('mainApp').classList.add('hidden');
}

function showApp() {
  $('authScreen').style.display = 'none';
  $('mainApp').classList.remove('hidden');
}

function switchAuthTab(tab) {
  const isSignUp = tab === 'signUp';
  const isForgot = tab === 'forgot';
  $('signInForm').classList.toggle('active', !isSignUp && !isForgot);
  $('signUpForm').classList.toggle('active', isSignUp);
  $('forgotForm').classList.toggle('active', isForgot);
  $('tabSignIn').classList.toggle('active', !isSignUp && !isForgot);
  $('tabSignUp').classList.toggle('active', isSignUp);
}

$('tabSignIn').addEventListener('click', () => switchAuthTab('signIn'));
$('tabSignUp').addEventListener('click', () => switchAuthTab('signUp'));
$('switchToSignUp').addEventListener('click', () => switchAuthTab('signUp'));
$('switchToSignIn').addEventListener('click', () => switchAuthTab('signIn'));
$('switchToForgot').addEventListener('click', () => switchAuthTab('forgot'));
$('switchForgotToSignIn').addEventListener('click', () => switchAuthTab('signIn'));

$('signInForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const profile = await API.profiles.login({
      email: $('siEmail').value.trim(),
      password: $('siPassword').value
    });
    State.session = { userId: profile.id, username: profile.username, email: profile.email };
    await onLoggedIn();
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('signUpForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const name = $('suName').value.trim();
    const password = $('suPassword').value;
    const confirmPassword = $('suPasswordConfirm').value;

    if (password !== confirmPassword) {
      toast('Passwords do not match', 'error');
      return;
    }

    const profile = await API.profiles.register({
      username: $('suUsername').value.trim(),
      email: $('suEmail').value.trim(),
      password,
      bio: $('suBio').value.trim() || name
    });
    State.session = { userId: profile.id, username: profile.username, email: profile.email };
    await onLoggedIn();
  } catch (err) {
    toast(err.message, 'error');
  }
});

$('forgotForm').addEventListener('submit', async e => {
  e.preventDefault();
  const password = $('fpPassword').value;
  const confirmPassword = $('fpPasswordConfirm').value;

  if (password !== confirmPassword) {
    toast('Passwords do not match', 'error');
    return;
  }

  try {
    await API.profiles.resetPassword({
      email: $('fpEmail').value.trim(),
      password
    });
    $('forgotForm').reset();
    switchAuthTab('signIn');
    toast('Password reset. You can sign in now.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function onLoggedIn() {
  showApp();
  updateNavUser();
  navigate('home');
  await Promise.all([loadEntries(), loadJournals(), loadStats()]);
  toast(`Welcome back, ${State.session.username}`, 'success');
}

function updateNavUser() {
  if (!State.session) return;
  $('navInitial').textContent = (State.session.username || '?')[0].toUpperCase();
  $('avatarName').textContent = State.session.username || '';
  $('avatarEmail').textContent = State.session.email || '';
}

$('navAvatar').addEventListener('click', e => {
  e.stopPropagation();
  $('avatarDropdown').classList.toggle('open');
});
document.addEventListener('click', () => $('avatarDropdown').classList.remove('open'));
$('logoutBtn').addEventListener('click', async () => {
  try { await API.profiles.logout(); } catch (_) {}
  State.session = null;
  State.entries = [];
  State.journals = [];
  showAuth();
});

function navigate(page) {
  $$('.page').forEach(p => p.classList.remove('active'));
  $$('.nav-btn').forEach(b => b.classList.toggle('active', b.dataset.page === page));
  const el = $(`page-${page}`);
  if (el) el.classList.add('active');
  if (page === 'journals') loadJournals();
  if (page === 'map') setTimeout(initMap, 50);
}

$$('[data-page]').forEach(btn => btn.addEventListener('click', () => navigate(btn.dataset.page)));

async function loadEntries() {
  const grid = $('entriesGrid');
  grid.innerHTML = '<div class="loading-state">Loading adventures...</div>';
  try {
    const params = {};
    if (State.filteredMood) params.mood = State.filteredMood;
    if (State.searchQuery) params.search = State.searchQuery;
    State.entries = await API.entries.list(params) || [];
    renderEntries();
    updateHeroCard();
    if ($('page-map').classList.contains('active')) initMap();
  } catch (err) {
    grid.innerHTML = `<div class="empty-state">${escapeHtml(err.message)}</div>`;
  }
}

function renderEntries() {
  const grid = $('entriesGrid');
  if (!State.entries.length) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>No adventures yet</h3>
        <p>Start documenting your travels with a pinned location, photos, and a story.</p>
        <button class="btn-primary" onclick="openNewEntry()">New Entry</button>
      </div>`;
    return;
  }

  grid.innerHTML = State.entries.map((entry, i) => {
    const photos = entryPhotos(entry);
    const cover = photos[0];
    const tags = (entry.entry_tags || []).slice(0, 3);
    return `
      <article class="entry-card" style="animation-delay:${i * 50}ms" onclick="openEntryDetail('${entry.id}')">
        <div class="card-image" style="${cover ? `background-image:url('${cover}')` : ''}">
          ${cover ? '' : '<span>Map</span>'}
          ${photos.length > 1 ? `<span class="photo-count">${photos.length} photos</span>` : ''}
        </div>
        <div class="card-body">
          <span class="card-location">${escapeHtml(entry.location || entry.country || '')}</span>
          <h3>${escapeHtml(entry.title)}</h3>
          <p>${escapeHtml(entry.content || '').slice(0, 140)}</p>
          <div class="card-footer">
            <span>${formatDate(entry.travel_date)}</span>
            <span>${MOOD_EMOJI[entry.mood] || ''} ${escapeHtml(entry.mood || '')}</span>
          </div>
          <div class="tag-row">${tags.map(t => `<span>${escapeHtml(t.tags?.name || '')}</span>`).join('')}</div>
          <div class="card-actions">
            <button onclick="openEditEntry('${entry.id}', event)">Edit</button>
            <button onclick="deleteEntry('${entry.id}', event)">Delete</button>
          </div>
        </div>
      </article>`;
  }).join('');
}

function updateHeroCard() {
  const latest = State.entries[0];
  if (!latest) {
    $('floatTitle').textContent = 'Start writing your first story';
    $('floatLoc').textContent = 'Somewhere amazing';
    $('floatImg').style.backgroundImage = '';
    $('floatImg').textContent = 'Map';
    return;
  }
  const photos = entryPhotos(latest);
  $('floatTitle').textContent = latest.title || 'Latest entry';
  $('floatLoc').textContent = latest.location || latest.country || 'Somewhere amazing';
  $('floatImg').style.backgroundImage = photos[0] ? `url('${photos[0]}')` : '';
  $('floatImg').textContent = photos[0] ? '' : 'Map';
}

async function deleteEntry(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this entry?')) return;
  try {
    await API.entries.delete(id);
    toast('Entry deleted', 'success');
    await Promise.all([loadEntries(), loadStats()]);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openNewEntry() {
  $('entryModalTitle').textContent = 'New Entry';
  $('entryForm').reset();
  $('entryId').value = '';
  $('entryDate').value = new Date().toISOString().split('T')[0];
  State.entryPhotosBase64 = [];
  renderPhotoPreview();
  populateJournalSelect(State.defaultJournalId);
  State.defaultJournalId = '';
  setPickedLocation(null);
  openModal('entryModal');
  setTimeout(initPickerMap, 120);
}

async function openEditEntry(id, e) {
  if (e) e.stopPropagation();
  try {
    const entry = await API.entries.get(id);
    $('entryModalTitle').textContent = 'Edit Entry';
    $('entryId').value = entry.id;
    $('entryTitle').value = entry.title || '';
    $('entryDate').value = entry.travel_date || '';
    $('entryLocation').value = entry.location || '';
    $('entryCountry').value = entry.country || '';
    $('entryMood').value = entry.mood || '';
    $('entryContent').value = entry.content || '';
    $('entryTags').value = (entry.entry_tags || []).map(t => t.tags?.name).filter(Boolean).join(', ');
    State.entryPhotosBase64 = entryPhotos(entry);
    renderPhotoPreview();
    await populateJournalSelect(entry.journal_id);
    setPickedLocation(entryCoords(entry));
    openModal('entryModal');
    setTimeout(() => initPickerMap(entryCoords(entry)), 120);
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function populateJournalSelect(selectedId = '') {
  if (!State.journals.length) {
    try { State.journals = await API.journals.list(); } catch (_) {}
  }
  $('entryJournal').innerHTML = '<option value="">No journal</option>' +
    State.journals.map(j => `<option value="${j.id}" ${j.id === selectedId ? 'selected' : ''}>${escapeHtml(j.title)}</option>`).join('');
}

function setPickedLocation(coords) {
  if (!coords) {
    $('entryLat').value = '';
    $('entryLng').value = '';
    $('pickedLocation').textContent = 'No pin selected yet';
    if (State.pickerMarker) State.pickerMarker.remove();
    State.pickerMarker = null;
    return;
  }
  const [lat, lng] = coords.map(Number);
  $('entryLat').value = lat.toFixed(6);
  $('entryLng').value = lng.toFixed(6);
  $('pickedLocation').textContent = `${lat.toFixed(4)}, ${lng.toFixed(4)}`;
  if (State.pickerMap) {
    if (State.pickerMarker) State.pickerMarker.setLatLng(coords);
    else State.pickerMarker = L.marker(coords).addTo(State.pickerMap);
    State.pickerMap.setView(coords, 5);
  }
}

function searchPlaceText() {
  return [
    $('entryPlaceSearch').value.trim(),
    $('entryLocation').value.trim(),
    $('entryCountry').value.trim()
  ].filter(Boolean).join(', ');
}

async function findAndPinPlace() {
  const query = searchPlaceText();
  if (!query) {
    toast('Type a place name first', 'error');
    return;
  }

  const btn = $('findPlaceBtn');
  const oldText = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Finding...';

  try {
    const params = new URLSearchParams({
      q: query,
      format: 'json',
      addressdetails: '1',
      limit: '1'
    });
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params.toString()}`, {
      headers: { Accept: 'application/json' }
    });
    if (!res.ok) throw new Error('Location search failed');

    const results = await res.json();
    if (!results.length) {
      const fallback = countryToCoords($('entryCountry').value || $('entryPlaceSearch').value);
      if (fallback) {
        setPickedLocation(fallback);
        toast('Pinned the country center', 'success');
        return;
      }
      toast('I could not find that place. Try adding the country name.', 'error');
      return;
    }

    const result = results[0];
    const coords = [Number(result.lat), Number(result.lon)];
    setPickedLocation(coords);

    const address = result.address || {};
    const locationName = address.city || address.town || address.village || address.suburb || address.county || result.name || $('entryPlaceSearch').value.trim();
    const countryName = address.country || $('entryCountry').value.trim();

    if (!$('entryLocation').value.trim() && locationName) $('entryLocation').value = locationName;
    if (!$('entryCountry').value.trim() && countryName) $('entryCountry').value = countryName;
    $('entryPlaceSearch').value = result.display_name || query;
    toast('Place found and pinned', 'success');
  } catch (err) {
    toast(err.message || 'Could not find that place', 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = oldText;
  }
}

function initPickerMap(coords = null) {
  const target = $('entryPickerMap');
  if (!target || typeof L === 'undefined') return;
  if (!State.pickerMap) {
    State.pickerMap = L.map('entryPickerMap').setView([20, 0], 2);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(State.pickerMap);
    State.pickerMap.on('click', e => setPickedLocation([e.latlng.lat, e.latlng.lng]));
  }
  State.pickerMap.invalidateSize();
  if (coords) setPickedLocation(coords);
}

$('useCountryCenter').addEventListener('click', () => {
  const coords = countryToCoords($('entryCountry').value);
  if (!coords) return toast('I do not know that country center yet. Click the map to place the pin.', 'error');
  setPickedLocation(coords);
});

$('findPlaceBtn').addEventListener('click', findAndPinPlace);
$('entryPlaceSearch').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    e.preventDefault();
    findAndPinPlace();
  }
});

$('entryCountry').addEventListener('blur', () => {
  if (!$('entryLat').value && !$('entryLng').value) {
    const coords = countryToCoords($('entryCountry').value);
    if (coords) setPickedLocation(coords);
  }
});

$('entryCoverFile').addEventListener('change', async e => {
  try {
    const photos = await API.filesToBase64(e.target.files);
    State.entryPhotosBase64 = [...State.entryPhotosBase64, ...photos];
    renderPhotoPreview();
    e.target.value = '';
  } catch (err) {
    toast(err.message, 'error');
  }
});

function renderPhotoPreview() {
  const el = $('entryPhotoPreview');
  if (!State.entryPhotosBase64.length) {
    el.innerHTML = '<span>No pictures selected yet</span>';
    return;
  }
  el.innerHTML = State.entryPhotosBase64.map((src, index) => `
    <div class="preview-tile">
      <img src="${src}" alt="Entry photo ${index + 1}" />
      <button type="button" onclick="removeEntryPhoto(${index})">x</button>
    </div>`).join('');
}

window.removeEntryPhoto = index => {
  State.entryPhotosBase64.splice(index, 1);
  renderPhotoPreview();
};

$('entryForm').addEventListener('submit', async e => {
  e.preventDefault();
  const id = $('entryId').value;
  const payload = {
    title: $('entryTitle').value.trim(),
    travel_date: $('entryDate').value,
    location: $('entryLocation').value.trim(),
    country: $('entryCountry').value.trim(),
    mood: $('entryMood').value,
    content: $('entryContent').value.trim(),
    journal_id: $('entryJournal').value || null,
    user_id: State.session?.userId,
    latitude: $('entryLat').value ? Number($('entryLat').value) : null,
    longitude: $('entryLng').value ? Number($('entryLng').value) : null,
    cover_image: State.entryPhotosBase64[0] || null,
    photos: State.entryPhotosBase64,
    tags: $('entryTags').value.split(',').map(t => t.trim()).filter(Boolean)
  };

  try {
    if (id) {
      await API.entries.update(id, payload);
      toast('Entry updated', 'success');
    } else {
      await API.entries.create(payload);
      toast('Journey saved and pinned', 'success');
    }
    closeModal('entryModal');
    await Promise.all([loadEntries(), loadStats()]);
    if ($('page-map').classList.contains('active')) await initMap();
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function loadJournals() {
  const grid = $('journalsGrid');
  if (!grid) return;
  grid.innerHTML = '<div class="loading-state">Loading journals...</div>';
  try {
    State.journals = await API.journals.list() || [];
    if (!State.journals.length) {
      grid.innerHTML = `
        <div class="empty-state">
          <h3>No journals yet</h3>
          <p>Create collections for trips, countries, or favorite seasons.</p>
          <button class="btn-primary" onclick="openModal('journalModal')">New Journal</button>
        </div>`;
      return;
    }
    grid.innerHTML = State.journals.map(j => {
      const count = journalEntryCount(j);
      return `
      <article class="journal-card" onclick="openJournalDetail('${j.id}')">
        <div class="journal-cover" style="${j.cover_image ? `background-image:url('${j.cover_image}')` : ''}">
          ${j.cover_image ? '' : 'Journal'}
          <span class="journal-count">${count} ${count === 1 ? 'entry' : 'entries'}</span>
        </div>
        <div class="journal-body">
          <h3>${escapeHtml(j.title)}</h3>
          <p>${escapeHtml(j.description || 'No description yet.')}</p>
          <span>${formatDate(j.created_at)} - ${j.is_public ? 'Public' : 'Private'}</span>
          <button onclick="deleteJournal('${j.id}', event)">Delete</button>
        </div>
      </article>`;
    }).join('');
  } catch (err) {
    grid.innerHTML = `
      <div class="empty-state">
        <h3>Journals could not load</h3>
        <p>${escapeHtml(err.message)}</p>
        <button class="btn-secondary" onclick="loadJournals()">Try Again</button>
      </div>`;
  }
}

$('journalForm').addEventListener('submit', async e => {
  e.preventDefault();
  try {
    const file = $('journalCoverFile').files[0];
    const cover = file ? await API.fileToBase64(file) : null;
    await API.journals.create({
      title: $('journalTitle').value.trim(),
      description: $('journalDesc').value.trim(),
      cover_image: cover,
      is_public: $('journalPublic').checked,
      user_id: State.session?.userId
    });
    closeModal('journalModal');
    $('journalForm').reset();
    await Promise.all([loadJournals(), loadStats()]);
    toast('Journal created', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

async function deleteJournal(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this journal and all its entries?')) return;
  try {
    await API.journals.delete(id);
    await Promise.all([loadJournals(), loadEntries(), loadStats()]);
    toast('Journal deleted', 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function openJournalDetail(id) {
  try {
    const journal = await API.journals.get(id);
    const entries = sortedEntries(journal.entries || []);
    State.previousPage = 'journals';
    $('journalDetail').innerHTML = `
      <div class="detail-hero" style="${journal.cover_image ? `background-image:url('${journal.cover_image}')` : ''}">
        <div>
          <span>${journal.is_public ? 'Public journal' : 'Private journal'}</span>
          <h1>${escapeHtml(journal.title)}</h1>
          <p>${escapeHtml(journal.description || 'No description yet.')}</p>
          <small>By ${escapeHtml(journal.profiles?.username || State.session?.username || 'you')} - ${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}</small>
          <div class="detail-actions">
            <button class="btn-primary" onclick="openNewEntryForJournal('${journal.id}')">Add Entry</button>
          </div>
        </div>
      </div>
      <div class="entries-grid">
        ${entries.map(entry => {
          const photos = entryPhotos(entry);
          return `
            <article class="entry-card" onclick="openEntryDetail('${entry.id}', 'journal-detail')">
              <div class="card-image" style="${photos[0] ? `background-image:url('${photos[0]}')` : ''}">${photos[0] ? '' : 'Map'}</div>
              <div class="card-body">
                <span class="card-location">${escapeHtml([entry.location, entry.country].filter(Boolean).join(', ') || 'Unpinned')}</span>
                <h3>${escapeHtml(entry.title)}</h3>
                <p>${escapeHtml(entry.content || '').slice(0, 130)}</p>
                <div class="card-footer">
                  <span>${formatDate(entry.travel_date)}</span>
                  <span>${entry.mood ? escapeHtml(entry.mood) : ''}</span>
                </div>
              </div>
            </article>`;
        }).join('') || `
          <div class="empty-state">
            <h3>This journal has no entries yet</h3>
            <p>Add the first memory to this collection.</p>
            <button class="btn-primary" onclick="openNewEntryForJournal('${journal.id}')">Add Entry</button>
          </div>`}
      </div>`;
    navigate('journal-detail');
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openNewEntryForJournal(journalId) {
  State.defaultJournalId = journalId;
  openNewEntry();
}

async function openEntryDetail(id, backPage = 'home') {
  try {
    const entry = await API.entries.get(id);
    State.previousPage = backPage;
    const photos = entryPhotos(entry);
    const tags = (entry.entry_tags || []).map(t => t.tags?.name).filter(Boolean);
    const place = [entry.location, entry.country].filter(Boolean).join(', ') || 'Unpinned place';
    $('entryDetail').innerHTML = `
      <article class="entry-detail">
        <div class="entry-detail-hero" style="${photos[0] ? `background-image:linear-gradient(rgba(31,42,36,0.24), rgba(31,42,36,0.7)), url('${photos[0]}')` : ''}">
          <div class="entry-detail-copy">
            <span>${escapeHtml(entry.journals?.title || 'Travel entry')}</span>
            <h1>${escapeHtml(entry.title)}</h1>
            <p>${escapeHtml(place)} - ${formatDate(entry.travel_date) || 'No date added'}</p>
          </div>
        </div>
        <div class="photo-gallery">
          ${photos.map(src => `<img src="${src}" alt="${escapeHtml(entry.title)} photo" />`).join('') || '<div class="empty-state">No photos added.</div>'}
        </div>
        <div class="entry-story">
          <div class="story-kicker">${escapeHtml(entry.mood || 'Journal note')}</div>
          <p>${escapeHtml(entry.content || 'No story added yet.')}</p>
          <div class="tag-row">${tags.map(tag => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
        </div>
      </article>`;
    navigate('entry-detail');
  } catch (err) {
    toast(err.message, 'error');
  }
}

$('backFromEntry').addEventListener('click', () => navigate(State.previousPage || 'home'));

async function loadStats() {
  try {
    const [entries, journals] = await Promise.all([API.entries.list(), API.journals.list()]);
    const countries = [...new Set(entries.map(e => e.country).filter(Boolean))];
    $('statEntries').textContent = entries.length;
    $('statCountries').textContent = countries.length;
    $('statJournals').textContent = journals.length;
  } catch (_) {}
}

async function initMap() {
  const mapContainer = $('leafletMap');
  if (!mapContainer || typeof L === 'undefined') return;

  if (!State.leafletMap) {
    State.leafletMap = L.map('leafletMap').setView([20, 0], 2);
    L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
      attribution: '&copy; OpenStreetMap &copy; CARTO',
      subdomains: 'abcd',
      maxZoom: 20
    }).addTo(State.leafletMap);
  }
  State.leafletMap.invalidateSize();
  State.leafletMarkers.forEach(marker => marker.remove());
  State.leafletMarkers = [];

  try {
    const entries = await API.entries.list();
    const placeGroups = new Map();
    entries.forEach(entry => {
      const coords = entryCoords(entry);
      if (!coords) return;
      const key = coords.map(n => Number(n).toFixed(4)).join(',');
      if (!placeGroups.has(key)) placeGroups.set(key, { coords, entries: [] });
      placeGroups.get(key).entries.push(entry);
    });

    placeGroups.forEach(group => {
      const label = group.entries[0].location || group.entries[0].country || 'Pinned place';
      const marker = L.marker(group.coords)
        .addTo(State.leafletMap)
        .bindPopup(`
          <div class="map-popup">
            <h4>${escapeHtml(label)}</h4>
            <p>${group.entries.length} ${group.entries.length === 1 ? 'entry' : 'entries'}</p>
            <button onclick="openEntryDetail('${group.entries[0].id}', 'map')">Open latest</button>
          </div>
        `);
      State.leafletMarkers.push(marker);
    });

    if (State.leafletMarkers.length) {
      State.leafletMap.fitBounds(L.featureGroup(State.leafletMarkers).getBounds().pad(0.35));
    }
    renderCountryList(entries);
  } catch (err) {
    toast(err.message, 'error');
  }
}

function renderCountryList(entries) {
  const list = $('countryList');
  const grouped = entries.reduce((acc, entry) => {
    const name = entry.country || 'Unknown';
    acc[name] = acc[name] || [];
    acc[name].push(entry);
    return acc;
  }, {});
  const countries = Object.keys(grouped).sort();
  list.innerHTML = countries.length
    ? countries.map(country => `<li><strong>${escapeHtml(country)}</strong><span>${grouped[country].length} entries</span></li>`).join('')
    : '<li class="country-placeholder">Add entries to populate your map</li>';
  $('mapSubtitle').textContent = `${entries.length} pinned ${entries.length === 1 ? 'memory' : 'memories'}`;
}

function openModal(id) {
  $(id).classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal(id) {
  $(id).classList.remove('open');
  document.body.style.overflow = '';
}

$$('.modal-overlay').forEach(overlay => {
  overlay.addEventListener('click', e => {
    if (e.target === overlay) closeModal(overlay.id);
  });
});
$$('[data-close]').forEach(btn => btn.addEventListener('click', () => closeModal(btn.dataset.close)));
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') $$('.modal-overlay.open').forEach(m => closeModal(m.id));
});

$('newEntryBtn').addEventListener('click', openNewEntry);
$('heroNewEntry').addEventListener('click', openNewEntry);
$('mapNewEntryBtn').addEventListener('click', openNewEntry);
$('newJournalBtn').addEventListener('click', () => openModal('journalModal'));

let searchTimer;
$('searchInput').addEventListener('input', e => {
  clearTimeout(searchTimer);
  searchTimer = setTimeout(() => {
    State.searchQuery = e.target.value.trim();
    loadEntries();
  }, 300);
});

$('filterPills').addEventListener('click', e => {
  const pill = e.target.closest('.pill');
  if (!pill) return;
  $$('.pill').forEach(p => p.classList.remove('active'));
  pill.classList.add('active');
  State.filteredMood = pill.dataset.mood;
  loadEntries();
});

window.openNewEntry = openNewEntry;
window.openNewEntryForJournal = openNewEntryForJournal;
window.openEditEntry = openEditEntry;
window.deleteEntry = deleteEntry;
window.deleteJournal = deleteJournal;
window.openJournalDetail = openJournalDetail;
window.openEntryDetail = openEntryDetail;

(async function init() {
  try {
    const me = await API.profiles.me();
    if (me?.userId) {
      State.session = me;
      updateNavUser();
      showApp();
      navigate('home');
      await Promise.all([loadEntries(), loadJournals(), loadStats()]);
      return;
    }
  } catch (_) {}
  showAuth();
})();

