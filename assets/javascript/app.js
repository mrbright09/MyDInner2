
// Google Places API Key (replace with your actual API key)
const GOOGLE_PLACES_API_KEY = "AIzaSyCPVHfqr6zFjaR5ZPYP8NSMESGkxWJ9QfI";

// Global Variables
const sessionData = {
  restaurants: [],
  participants: [],
  currentParticipantIndex: 0,
};

// DOM Elements
const restaurantList = document.getElementById("restaurant-list");
const participantList = document.getElementById("participant-list");
const resultsSection = document.getElementById("results-section");
const finalChoice = document.getElementById("final-choice");
const participantInputSection = document.getElementById("participant-input-section");
const startVotingButton = document.getElementById("start-voting");
const votingSection = document.getElementById("voting-section");

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

// Render Restaurants for Voting
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

// Handle Voting by Participants
function handleVote(restaurantId) {
  const currentParticipant = sessionData.participants[sessionData.currentParticipantIndex];
  currentParticipant.vote = restaurantId;

  // Move to the next participant or finalize results
  if (sessionData.currentParticipantIndex < sessionData.participants.length - 1) {
    sessionData.currentParticipantIndex++;
    updateParticipantVotingUI();
  } else {
    displayResults();
  }
}

// Update the Voting UI for the Current Participant
function updateParticipantVotingUI() {
  const currentParticipant = sessionData.participants[sessionData.currentParticipantIndex];
  const votingHeader = document.getElementById("voting-header");
  votingHeader.textContent = `It's ${currentParticipant.name}'s turn to vote!`;
}

// Display Results After Voting
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

// Log Results for Download
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
}

// Initialize Participants Input
function initializeParticipantInput() {
  participantInputSection.innerHTML = "";
  for (let i = 1; i <= 8; i++) {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "form-control mb-2";
    input.placeholder = `Enter name for Participant ${i} (Optional)`;
    input.id = `participant-${i}`;
    participantInputSection.appendChild(input);
  }
}

// Start Voting Process
function startVoting() {
  sessionData.participants = [];
  for (let i = 1; i <= 8; i++) {
    const input = document.getElementById(`participant-${i}`);
    if (input.value.trim() !== "") {
      sessionData.participants.push({ id: i, name: input.value.trim(), vote: null });
    }
  }
  if (sessionData.participants.length === 0) {
    alert("Please enter at least one participant name to proceed.");
    return;
  }
  participantInputSection.classList.add("d-none");
  startVotingButton.classList.add("d-none");
  votingSection.classList.remove("d-none");
  sessionData.currentParticipantIndex = 0;
  updateParticipantVotingUI();
  renderRestaurants();
}

// Initialize
function initializeSession() {
  initializeParticipantInput();
}

// Start
initializeSession();
