// ================================================================
//  MyDinner — App Logic
//  Flow: Step 1 (cuisines) → 2 (location) → 3 (camera) →
//        4 (reaction analysis) → 5 (results)
// ================================================================

// ---------- Configuration ----------
const CONFIG = {
  GOOGLE_API_KEY:      'AIzaSyCPVHfqr6zFjaR5ZPYP8NSMESGkxWJ9QfI',
  SEARCH_RADIUS:       2400,          // meters
  REACTION_DURATION:   5000,          // ms per restaurant
  COUNTDOWN_SECONDS:   3,
  MAX_RESTAURANTS:     6,
  DETECT_INTERVAL_MS:  220,           // ms between face-api calls (~4.5 fps)
  FACE_MODELS_URL:     'https://cdn.jsdelivr.net/npm/@vladmandic/face-api@1.7.14/model',
};

// ---------- Cuisine Definitions ----------
const CUISINES = [
  { id: 'mexican',       name: 'Mexican',       emoji: '🌮', keyword: 'Mexican' },
  { id: 'bbq',           name: 'BBQ',           emoji: '🔥', keyword: 'Barbecue BBQ' },
  { id: 'chinese',       name: 'Chinese',       emoji: '🥢', keyword: 'Chinese' },
  { id: 'italian',       name: 'Italian',       emoji: '🍝', keyword: 'Italian' },
  { id: 'japanese',      name: 'Japanese',      emoji: '🍱', keyword: 'Japanese' },
  { id: 'indian',        name: 'Indian',        emoji: '🍛', keyword: 'Indian' },
  { id: 'thai',          name: 'Thai',          emoji: '🍜', keyword: 'Thai' },
  { id: 'mediterranean', name: 'Mediterranean', emoji: '🥙', keyword: 'Mediterranean' },
  { id: 'american',      name: 'American',      emoji: '🍔', keyword: 'American diner' },
  { id: 'korean',        name: 'Korean',        emoji: '🥩', keyword: 'Korean' },
  { id: 'greek',         name: 'Greek',         emoji: '🫒', keyword: 'Greek' },
  { id: 'pizza',         name: 'Pizza',         emoji: '🍕', keyword: 'Pizza' },
  { id: 'seafood',       name: 'Seafood',       emoji: '🦞', keyword: 'Seafood' },
  { id: 'vegan',         name: 'Vegan',         emoji: '🥗', keyword: 'Vegan Vegetarian' },
  { id: 'sushi',         name: 'Sushi',         emoji: '🍣', keyword: 'Sushi' },
  { id: 'burgers',       name: 'Burgers',       emoji: '🍟', keyword: 'Burgers' },
];

// ---------- App State ----------
const state = {
  selectedCuisines:      [],
  userLocation:          null,
  restaurants:           [],
  restaurantScores:      [],
  currentRestaurantIdx:  0,
  videoStream:           null,
  mapsLoaded:            false,
  modelsLoaded:          false,
  placesService:         null,
};

// ================================================================
//  INIT
// ================================================================
document.addEventListener('DOMContentLoaded', () => {
  buildCuisineGrid();
});

// ================================================================
//  STEP 1 — CUISINE SELECTION
// ================================================================

function buildCuisineGrid() {
  const grid = document.getElementById('cuisine-grid');
  grid.innerHTML = CUISINES.map(c =>
    `<div class="cuisine-card" id="cuisine-${c.id}" onclick="toggleCuisine('${c.id}')">
       <div class="cuisine-emoji">${c.emoji}</div>
       <div class="cuisine-name">${c.name}</div>
     </div>`
  ).join('');
}

function toggleCuisine(id) {
  const card = document.getElementById(`cuisine-${id}`);
  const pos  = state.selectedCuisines.indexOf(id);
  if (pos === -1) {
    state.selectedCuisines.push(id);
    card.classList.add('selected');
  } else {
    state.selectedCuisines.splice(pos, 1);
    card.classList.remove('selected');
  }
  document.getElementById('btn-find-restaurants').disabled = state.selectedCuisines.length === 0;
}

// ================================================================
//  STEP 2 — LOCATION
// ================================================================

async function proceedToLocation() {
  if (!state.selectedCuisines.length) return;
  goToStep(2);

  // Begin loading Maps API in the background immediately
  loadMapsAPI().then(() => { state.mapsLoaded = true; }).catch(() => {});

  if (!navigator.geolocation) {
    setLocationMsg('Geolocation not supported by your browser.');
    showManualEntry();
    return;
  }

  setLocationMsg('Detecting your location…');
  showSpinner(true);

  navigator.geolocation.getCurrentPosition(
    async (pos) => {
      state.userLocation = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      setLocationMsg('Location found! Searching for restaurants…');
      await ensureMapsLoaded();
      doRestaurantSearch();
    },
    () => {
      showSpinner(false);
      setLocationMsg('Could not auto-detect location.');
      showManualEntry();
    },
    { timeout: 10000 }
  );
}

function setLocationMsg(msg) {
  document.getElementById('location-message').textContent = msg;
}

function showSpinner(on) {
  document.getElementById('location-spinner').style.display = on ? 'block' : 'none';
}

function showManualEntry() {
  document.getElementById('manual-location').classList.remove('d-none');
}

async function useManualLocation() {
  const query = document.getElementById('zip-input').value.trim();
  if (!query) { alert('Please enter a ZIP code or city name.'); return; }

  showSpinner(true);
  setLocationMsg('Looking up your location…');
  document.getElementById('manual-location').classList.add('d-none');

  try {
    await ensureMapsLoaded();
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ address: query }, (results, status) => {
      if (status === 'OK' && results[0]) {
        const loc = results[0].geometry.location;
        state.userLocation = { lat: loc.lat(), lng: loc.lng() };
        setLocationMsg('Location found! Searching for restaurants…');
        doRestaurantSearch();
      } else {
        showSpinner(false);
        setLocationMsg('Could not find that location. Please try again.');
        showManualEntry();
      }
    });
  } catch (e) {
    showSpinner(false);
    setLocationMsg('Maps API failed to load. Check your API key and connection.');
    showManualEntry();
  }
}

// ================================================================
//  GOOGLE MAPS API
// ================================================================

function loadMapsAPI() {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps && window.google.maps.places) {
      return resolve();
    }
    if (document.getElementById('gmap-script')) {
      // Already loading — wait for it
      document.getElementById('gmap-script').addEventListener('load', resolve);
      document.getElementById('gmap-script').addEventListener('error', reject);
      return;
    }
    const s   = document.createElement('script');
    s.id      = 'gmap-script';
    s.src     = `https://maps.googleapis.com/maps/api/js?key=${CONFIG.GOOGLE_API_KEY}&libraries=places`;
    s.async   = true;
    s.onload  = resolve;
    s.onerror = () => reject(new Error('Google Maps API failed to load'));
    document.head.appendChild(s);
  });
}

async function ensureMapsLoaded() {
  if (!state.mapsLoaded) {
    await loadMapsAPI();
    state.mapsLoaded = true;
  }
}

function getPlacesService() {
  if (!state.placesService) {
    // PlacesService needs a Map or attributed div
    const attrDiv = document.createElement('div');
    attrDiv.style.cssText = 'width:1px;height:1px;overflow:hidden;position:fixed;top:-1000px;';
    document.body.appendChild(attrDiv);
    const tempMap = new google.maps.Map(attrDiv, {
      center: state.userLocation,
      zoom:   14,
    });
    state.placesService = new google.maps.places.PlacesService(tempMap);
  }
  return state.placesService;
}

// ================================================================
//  RESTAURANT SEARCH
// ================================================================

function doRestaurantSearch() {
  const service      = getPlacesService();
  const latLng       = new google.maps.LatLng(state.userLocation.lat, state.userLocation.lng);
  const cuisineList  = state.selectedCuisines.map(id => CUISINES.find(c => c.id === id));
  const collected    = [];
  let   done         = 0;

  for (const cuisine of cuisineList) {
    service.nearbySearch(
      {
        location: latLng,
        radius:   CONFIG.SEARCH_RADIUS,
        keyword:  cuisine.keyword,
        type:     'restaurant',
      },
      (results, status) => {
        if (status === google.maps.places.PlacesServiceStatus.OK && results) {
          results.slice(0, 4).forEach(r => collected.push({ ...r, cuisineType: cuisine.name }));
        }
        done++;
        if (done === cuisineList.length) finaliseRestaurants(collected);
      }
    );
  }
}

function finaliseRestaurants(raw) {
  // Deduplicate by place_id (first occurrence keeps its cuisineType)
  const seen   = new Set();
  const unique = raw.filter(r => { if (seen.has(r.place_id)) return false; seen.add(r.place_id); return true; });

  // Sort by rating desc
  unique.sort((a, b) => (b.rating || 0) - (a.rating || 0));

  state.restaurants = unique.slice(0, CONFIG.MAX_RESTAURANTS);

  if (!state.restaurants.length) {
    showSpinner(false);
    setLocationMsg('No restaurants found nearby. Try a different location or widen your cuisine choices.');
    showManualEntry();
    return;
  }

  showSpinner(false);
  goToStep(3);
}

// ================================================================
//  STEP 3 — CAMERA SETUP
// ================================================================

async function setupCamera() {
  const btn = document.getElementById('btn-allow-camera');
  btn.disabled    = true;
  btn.textContent = 'Requesting access…';

  // Warn if not on secure origin
  const isSecure = location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if (!isSecure) {
    setCameraMsg('⚠️ Camera requires HTTPS. Please host this app over HTTPS or use localhost.');
    btn.disabled    = false;
    btn.textContent = 'Allow Camera Access';
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      audio: false,
    });
    state.videoStream = stream;

    const video     = document.getElementById('setup-video');
    video.srcObject = stream;
    video.classList.remove('d-none');
    document.getElementById('camera-placeholder').style.display = 'none';
    setCameraMsg('Camera ready! Loading AI models…');

    btn.classList.add('d-none');
    document.getElementById('model-loading').classList.remove('d-none');

    await loadFaceModels();

    document.getElementById('model-loading').classList.add('d-none');
    setCameraMsg('All set! Press the button below when you\'re ready.');
    document.getElementById('btn-start-analysis').classList.remove('d-none');
  } catch (err) {
    btn.disabled    = false;
    btn.textContent = 'Try Again';
    setCameraMsg(`Camera error: ${err.message}`);
  }
}

function setCameraMsg(msg) {
  document.getElementById('camera-message').textContent = msg;
}

async function loadFaceModels() {
  const bar = document.getElementById('model-progress');
  bar.style.width = '10%';
  await faceapi.nets.tinyFaceDetector.loadFromUri(CONFIG.FACE_MODELS_URL);
  bar.style.width = '65%';
  await faceapi.nets.faceExpressionNet.loadFromUri(CONFIG.FACE_MODELS_URL);
  bar.style.width = '100%';
  state.modelsLoaded = true;
}

// ================================================================
//  STEP 4 — REACTION ANALYSIS
// ================================================================

function startAnalysis() {
  // Attach the same stream to the analysis video element
  const vid     = document.getElementById('analysis-video');
  vid.srcObject = state.videoStream;

  state.currentRestaurantIdx = 0;
  state.restaurantScores     = state.restaurants.map(r => ({
    restaurant:  r,
    totalScore:  0,
    sampleCount: 0,
    peakHappy:   0,
  }));

  document.getElementById('total-restaurants').textContent = state.restaurants.length;
  goToStep(4);

  // Small delay to allow DOM to render before starting
  setTimeout(analyseNext, 350);
}

function analyseNext() {
  if (state.currentRestaurantIdx >= state.restaurants.length) {
    showResults();
    return;
  }

  const restaurant = state.restaurants[state.currentRestaurantIdx];
  renderRestaurantCard(restaurant);
  document.getElementById('current-restaurant-num').textContent = state.currentRestaurantIdx + 1;

  // Reset sub-panels
  document.getElementById('reaction-display').classList.add('d-none');
  document.getElementById('analyzing-progress').classList.add('d-none');
  document.getElementById('no-face-msg').classList.add('d-none');
  document.getElementById('countdown-display').classList.remove('d-none');

  startCountdown(CONFIG.COUNTDOWN_SECONDS, () => {
    document.getElementById('countdown-display').classList.add('d-none');
    document.getElementById('reaction-display').classList.remove('d-none');
    document.getElementById('analyzing-progress').classList.remove('d-none');

    captureReactions(state.currentRestaurantIdx).then(() => {
      state.currentRestaurantIdx++;
      setTimeout(analyseNext, 400);
    });
  });
}

function renderRestaurantCard(r) {
  // Force re-animation by cloning the card
  const card     = document.getElementById('restaurant-card');
  const clone    = card.cloneNode(true);
  card.parentNode.replaceChild(clone, card);

  clone.querySelector('#restaurant-name').textContent       = r.name;
  clone.querySelector('#restaurant-address').textContent    = r.vicinity || 'Address unavailable';
  clone.querySelector('#restaurant-cuisine-tag').textContent = r.cuisineType || 'Restaurant';

  const rating  = r.rating;
  const stars   = rating ? '⭐'.repeat(Math.min(Math.round(rating), 5)) : '—';
  clone.querySelector('#restaurant-stars').textContent      = stars;
  clone.querySelector('#rating-value').textContent          = rating ? rating.toFixed(1) : 'No rating';

  const photoArea = clone.querySelector('#restaurant-photo-area');
  if (r.photos && r.photos.length) {
    try {
      const url = r.photos[0].getUrl({ maxWidth: 480, maxHeight: 280 });
      photoArea.innerHTML = `<img src="${url}" alt="${r.name}" onerror="this.parentElement.innerHTML='<div class=\\'photo-fallback\\'>🍽️</div>'">`;
    } catch (_) {
      photoArea.innerHTML = `<div class="photo-fallback">🍽️</div>`;
    }
  } else {
    photoArea.innerHTML = `<div class="photo-fallback">🍽️</div>`;
  }
}

function startCountdown(seconds, done) {
  let n  = seconds;
  const el = document.getElementById('countdown-number');
  el.textContent = n;

  const tick = () => {
    n--;
    if (n <= 0) { done(); return; }
    el.textContent = n;
    setTimeout(tick, 1000);
  };
  setTimeout(tick, 1000);
}

function captureReactions(idx) {
  return new Promise(resolve => {
    const video    = document.getElementById('analysis-video');
    const progBar  = document.getElementById('analysis-progress-bar');
    const start    = Date.now();
    let   running  = true;

    const tick = async () => {
      if (!running) return;

      const elapsed = Date.now() - start;
      progBar.style.width = `${Math.min((elapsed / CONFIG.REACTION_DURATION) * 100, 100).toFixed(1)}%`;

      if (elapsed >= CONFIG.REACTION_DURATION) {
        running = false;
        resolve();
        return;
      }

      try {
        const detection = await faceapi
          .detectSingleFace(video, new faceapi.TinyFaceDetectorOptions({ inputSize: 224, scoreThreshold: 0.4 }))
          .withFaceExpressions();

        if (detection) {
          const expr = detection.expressions;
          updateReactionUI(expr);

          // Weighted score: positive reactions boost, negative reactions penalise
          const score =
              (expr.happy      || 0) * 3.0
            + (expr.surprised  || 0) * 0.8
            - (expr.disgusted  || 0) * 2.5
            - (expr.angry      || 0) * 2.0
            - (expr.sad        || 0) * 1.5;

          state.restaurantScores[idx].totalScore  += score;
          state.restaurantScores[idx].sampleCount += 1;
          if ((expr.happy || 0) > state.restaurantScores[idx].peakHappy) {
            state.restaurantScores[idx].peakHappy = expr.happy;
          }
          document.getElementById('no-face-msg').classList.add('d-none');
        } else {
          document.getElementById('no-face-msg').classList.remove('d-none');
        }
      } catch (_) { /* silently ignore individual detection errors */ }

      setTimeout(tick, CONFIG.DETECT_INTERVAL_MS);
    };

    tick();
  });
}

function updateReactionUI(expr) {
  const EMOJIS = {
    happy: '😊', surprised: '😲', neutral: '😐',
    disgusted: '🤢', angry: '😠', fearful: '😨', sad: '😢',
  };
  const dominant = Object.entries(expr).sort((a, b) => b[1] - a[1])[0];

  document.getElementById('reaction-emoji').textContent  = EMOJIS[dominant[0]] || '😐';
  document.getElementById('reaction-text').textContent   =
    dominant[0].charAt(0).toUpperCase() + dominant[0].slice(1);

  document.getElementById('bar-happy').style.width      = pct(expr.happy);
  document.getElementById('bar-surprised').style.width  = pct(expr.surprised);
  document.getElementById('bar-neutral').style.width    = pct(expr.neutral);
  document.getElementById('bar-disgusted').style.width  = pct(expr.disgusted);
}

function pct(val) { return `${((val || 0) * 100).toFixed(0)}%`; }

// ================================================================
//  STEP 5 — RESULTS
// ================================================================

function showResults() {
  // Stop webcam
  if (state.videoStream) {
    state.videoStream.getTracks().forEach(t => t.stop());
    state.videoStream = null;
  }

  // Sort restaurants by average reaction score
  const scored = state.restaurantScores
    .map(item => ({
      ...item,
      avgScore: item.sampleCount > 0 ? item.totalScore / item.sampleCount : 0,
    }))
    .sort((a, b) => b.avgScore - a.avgScore);

  const winner = scored[0];

  // --- Winner card ---
  document.getElementById('winner-name').textContent    = winner.restaurant.name;
  document.getElementById('winner-address').textContent = winner.restaurant.vicinity || '';

  const rating = winner.restaurant.rating;
  document.getElementById('winner-rating').innerHTML = rating
    ? `${'⭐'.repeat(Math.min(Math.round(rating), 5))} <span class="rating-num">${rating.toFixed(1)}</span>`
    : '';

  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    winner.restaurant.name + ' ' + (winner.restaurant.vicinity || '')
  )}&query_place_id=${winner.restaurant.place_id}`;
  document.getElementById('winner-maps-link').href = mapsUrl;

  const winnerPhoto = document.getElementById('winner-photo-area');
  if (winner.restaurant.photos && winner.restaurant.photos.length) {
    try {
      const url = winner.restaurant.photos[0].getUrl({ maxWidth: 600, maxHeight: 360 });
      winnerPhoto.innerHTML = `<img src="${url}" alt="${winner.restaurant.name}">`;
    } catch (_) {
      winnerPhoto.innerHTML = `<div class="winner-photo-fallback">🏆</div>`;
    }
  } else {
    winnerPhoto.innerHTML = `<div class="winner-photo-fallback">🏆</div>`;
  }

  // --- All results list ---
  const MEDALS = ['🥇', '🥈', '🥉'];
  document.getElementById('all-results').innerHTML = scored.map((item, i) => {
    const medal      = MEDALS[i] || `${i + 1}.`;
    const emoji      = item.avgScore > 0.5 ? '😄' : item.avgScore > 0.1 ? '🙂' : item.avgScore > -0.2 ? '😐' : '😕';
    const barWidth   = Math.max(4, Math.min(100, (item.avgScore + 1) * 50)).toFixed(0);
    const barClass   = item.avgScore > 0 ? 'positive' : 'neutral-score';

    return `
      <div class="result-row ${i === 0 ? 'is-winner' : ''}">
        <div class="result-rank">${medal}</div>
        <div class="result-info">
          <div class="result-name">${item.restaurant.name}</div>
          <div class="result-cuisine">${item.restaurant.cuisineType || ''}</div>
          <div class="score-bar-wrap">
            <div class="score-bar">
              <div class="score-bar-fill ${barClass}" style="width:${barWidth}%"></div>
            </div>
            <span class="score-label">${item.avgScore.toFixed(2)}</span>
          </div>
        </div>
        <div class="result-reaction">${emoji}</div>
      </div>
    `;
  }).join('');

  goToStep(5);
}

// ================================================================
//  NAVIGATION
// ================================================================

function goToStep(n) {
  document.querySelectorAll('.step').forEach(s => s.classList.remove('active'));
  document.getElementById(`step-${n}`).classList.add('active');

  document.querySelectorAll('.step-indicator').forEach(dot => {
    const s = parseInt(dot.dataset.step, 10);
    dot.classList.remove('current', 'done');
    if (s === n)  dot.classList.add('current');
    if (s <  n)  dot.classList.add('done');
  });

  // Show/hide fixed header
  document.getElementById('app-header').style.display = n > 1 ? 'block' : 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ================================================================
//  RESTART
// ================================================================

function restartApp() {
  // Stop any lingering stream
  if (state.videoStream) {
    state.videoStream.getTracks().forEach(t => t.stop());
  }

  Object.assign(state, {
    selectedCuisines:     [],
    userLocation:         null,
    restaurants:          [],
    restaurantScores:     [],
    currentRestaurantIdx: 0,
    videoStream:          null,
    modelsLoaded:         false,
    placesService:        null,
  });

  // Reset cuisine cards
  document.querySelectorAll('.cuisine-card').forEach(c => c.classList.remove('selected'));
  document.getElementById('btn-find-restaurants').disabled = true;

  // Reset location step
  document.getElementById('manual-location').classList.add('d-none');
  document.getElementById('zip-input').value = '';

  // Reset camera step
  const vid = document.getElementById('setup-video');
  vid.srcObject = null;
  vid.classList.add('d-none');
  document.getElementById('camera-placeholder').style.display = '';
  document.getElementById('camera-message').textContent = 'Click below to allow camera access';
  document.getElementById('btn-allow-camera').classList.remove('d-none');
  document.getElementById('btn-allow-camera').disabled    = false;
  document.getElementById('btn-allow-camera').textContent = 'Allow Camera Access';
  document.getElementById('btn-start-analysis').classList.add('d-none');
  document.getElementById('model-loading').classList.add('d-none');

  goToStep(1);
}
