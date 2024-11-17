
// Google Places API Key (replace with your actual API key)
const GOOGLE_PLACES_API_KEY = "YOUR_GOOGLE_PLACES_API_KEY";

// Global Variables
const sessionData = {
  restaurants: [],
  participants: [],
  sessionId: generateSessionId(),
};

// DOM Elements
const restaurantList = document.getElementById("restaurant-list");
const participantList = document.getElementById("participant-list");
const resultsSection = document.getElementById("results-section");
const finalChoice = document.getElementById("final-choice");
const inviteLinkDisplay = document.getElementById("invite-link");
const participantInputSection = document.getElementById("participant-input-section");
const startVotingButton = document.getElementById("start-voting");

// Generate Session ID
function generateSessionId() {
  return Math.random().toString(36).substring(2, 15);
}

// Display Sharable Link
function displayInviteLink() {
  const link = `${window.location.origin}/vote?session=${sessionData.sessionId}`;
  inviteLinkDisplay.textContent = link;
  inviteLinkDisplay.href = link;
}

// Fetch Restaurants from Google Places API
async function fetchRestaurants(location) {
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?location=${location}&radius=1500&type=restaurant&key=${GOOGLE_PLACES_API_KEY}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.results) {
      sessionData.restaurants = data.results.map((place) => ({
        id: place.place_id,
        name: place.name,
        address: place.vicinity,
        rating: place.rating,
      }));
      renderRestaurants();
    } else {
      console.error("No results from Google Places API.");
    }
  } catch (error) {
    console.error("Error fetching restaurants:", error);
  }
}

// Render Restaurants
function renderRestaurants() {
  restaurantList.innerHTML = "";
  sessionData.restaurants.forEach((restaurant) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    li.textContent = `${restaurant.name} (${restaurant.rating || "N/A"})`;
    li.onclick = () => handleVote(restaurant.id);
    restaurantList.appendChild(li);
  });
}

// Handle Voting
function handleVote(restaurantId) {
  const participant = sessionData.participants.find((p) => !p.vote);
  if (!participant) {
    alert("All participants have voted!");
    displayResults();
    return;
  }
  participant.vote = restaurantId;
  renderParticipants();
  if (sessionData.participants.every((p) => p.vote)) {
    displayResults(); // Show results once all votes are cast
  }
}

// Render Participants
function renderParticipants() {
  participantList.innerHTML = "";
  sessionData.participants.forEach((participant) => {
    const li = document.createElement("li");
    li.className = "list-group-item";
    const restaurant = sessionData.restaurants.find((r) => r.id === participant.vote);
    li.textContent = `${participant.name}: ${restaurant ? restaurant.name : "No vote yet"}`;
    participantList.appendChild(li);
  });
}

// Display Results
function displayResults() {
  const voteCounts = sessionData.restaurants.map((r) => ({
    ...r,
    votes: sessionData.participants.filter((p) => p.vote === r.id).length,
  }));
  const winner = voteCounts.reduce((a, b) => (a.votes > b.votes ? a : b));
  finalChoice.textContent = `The group chose: ${winner.name}`;
  resultsSection.classList.remove("d-none");
  logResults();
}

// Log Results
function logResults() {
  const log = {
    timestamp: new Date().toISOString(),
    results: sessionData.restaurants.map((r) => ({
      name: r.name,
      votes: sessionData.participants.filter((p) => p.vote === r.id).length,
    })),
    participants: sessionData.participants.map((p) => ({
      name: p.name,
      vote: p.vote,
    })),
  };
  console.log("Session Log:", log);
  downloadLog(log);
}

// Download Log as JSON
function downloadLog(log) {
  const blob = new Blob([JSON.stringify(log, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `session_${sessionData.sessionId}.json`;
  a.click();
}

// Initialize Participants Input
function initializeParticipantInput() {
  participantInputSection.innerHTML = "";
  for (let i = 1; i <= 8; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control mb-2";
    input.placeholder = `Enter name for Participant ${i}`;
    input.id = `participant-${i}`;
    participantInputSection.appendChild(input);
  }
}

// Start Voting
function startVoting() {
  sessionData.participants = [];
  for (let i = 1; i <= 8; i++) {
    const input = document.getElementById(`participant-${i}`);
    if (input.value.trim() === "") {
      alert(`Please enter a name for Participant ${i}.`);
      return;
    }
    sessionData.participants.push({ id: i, name: input.value.trim(), vote: null });
  }
  participantInputSection.classList.add("d-none");
  startVotingButton.classList.add("d-none");
  renderParticipants();
  displayInviteLink();
}

// Initialize
function initializeSession() {
  initializeParticipantInput();
}

// Start
initializeSession();
