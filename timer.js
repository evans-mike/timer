// ========== Wake Lock (Chrome) + NoSleep.js (iOS) ==========
let wakeLock = null;
let noSleep = new NoSleep();
let wakeLockSupported = "wakeLock" in navigator;

async function enableScreenAwake() {
  if (wakeLockSupported) {
    try {
      wakeLock = await navigator.wakeLock.request("screen");
      console.log("Wake Lock active (Screen Wake Lock API)");
      wakeLock.addEventListener("release", () => {
        console.log("Wake Lock was released");
      });
    } catch (err) {
      console.warn("Wake Lock request failed, fallback to NoSleep");
      noSleep.enable();
    }
  } else {
    noSleep.enable();
    console.log("No Wake Lock support, using NoSleep.js");
  }
}

async function disableScreenAwake() {
  // Release Wake Lock if we have it
  if (wakeLock) {
    try {
      await wakeLock.release();
      wakeLock = null;
      console.log("Wake Lock released");
    } catch (err) {
      console.warn("Error releasing Wake Lock:", err);
    }
  }
  // Also disable NoSleep
  noSleep.disable();
  console.log("NoSleep disabled");
}

// ========== Timer Logic ==========

// We'll store time + dark mode in localStorage
const STORAGE_TIME_KEY = "timerValue"; // "MM:SS"
const STORAGE_THEME_KEY = "darkMode"; // "true" or "false"

// Timer states
// (No icons if we prefer them empty)
const stateColors = {
  idle: "#007ACC", // Light Modern "blue"
  running: "#267F99", // teal-ish
  paused: "#9C4CAD", // purple
  finished: "#B24747", // red-ish
};
const stateIcons = {
  idle: "",
  running: "",
  paused: "",
  finished: "",
};

let timerState = "idle";
let totalTime = 0;
let timeRemaining = 0;
let countdownInterval = null;

// Grab elements
const refreshButton = document.getElementById("refreshButton");
const darkModeToggle = document.getElementById("darkModeToggle");
const minutesSelect = document.getElementById("minutesSelect");
const secondsSelect = document.getElementById("secondsSelect");
const circleArea = document.getElementById("circleArea");
const circleForeground = document.getElementById("circleForeground");
const circleIcon = document.getElementById("circleIcon");
const timerText = document.getElementById("timerText");
const circleBackground = document.getElementById('circleBackground');
const body = document.body;

darkModeToggle.addEventListener('change', () => {
  if (darkModeToggle.checked) {
    body.classList.add('dark-mode');
    circleBackground.setAttribute('fill', '#333');
  } else {
    body.classList.remove('dark-mode');
    circleBackground.setAttribute('fill', '#EAEAEA');
  }
});

// Populate 0..59 for minutes & seconds
for (let i = 0; i < 60; i++) {
  const optMin = document.createElement("option");
  optMin.value = i;
  optMin.text = i.toString();
  minutesSelect.appendChild(optMin);

  const optSec = document.createElement("option");
  optSec.value = i;
  optSec.text = i.toString();
  secondsSelect.appendChild(optSec);
}

// On page load
function init() {
  // 1) Restore dark mode preference
  const storedDarkMode = localStorage.getItem(STORAGE_THEME_KEY);
  if (storedDarkMode === "true") {
    document.body.classList.add("dark-mode");
    darkModeToggle.checked = true;
  }

  // 2) Restore last used time or default
  const storedTime = localStorage.getItem(STORAGE_TIME_KEY);
  if (storedTime) {
    const [mm, ss] = storedTime.split(":").map(Number);
    minutesSelect.value = mm;
    secondsSelect.value = ss;
  } else {
    // Default to 20:00
    minutesSelect.value = 20;
    secondsSelect.value = 0;
  }

  // Idle state => set color, etc.
  setTimerState("idle");
  updateTimerFromDropdown();
  updateTimerTextAndArc(timeRemaining);
}

function setTimerState(newState) {
  timerState = newState;
  circleForeground.setAttribute("fill", stateColors[newState]);
  circleIcon.innerHTML = stateIcons[newState];
}

function updateTimerFromDropdown() {
  const mm = parseInt(minutesSelect.value, 10);
  const ss = parseInt(secondsSelect.value, 10);
  totalTime = mm * 60 + ss;
  localStorage.setItem(STORAGE_TIME_KEY, `${mm}:${ss}`);

  if (timerState === "idle" || timerState === "finished") {
    timeRemaining = totalTime;
  }
}

function onCircleTap() {
  if (timerState === "idle" || timerState === "finished") {
    startTimer();
    setTimerState("running");
    enableScreenAwake();
  } else if (timerState === "running") {
    pauseTimer();
    setTimerState("paused");
    disableScreenAwake();
  } else if (timerState === "paused") {
    resumeTimer();
    setTimerState("running");
    enableScreenAwake();
  }
}

function startTimer() {
  clearInterval(countdownInterval);
  updateTimerFromDropdown();
  timeRemaining = totalTime;
  runInterval();
}

function pauseTimer() {
  clearInterval(countdownInterval);
}

function resumeTimer() {
  runInterval();
}

function runInterval() {
  updateTimerTextAndArc(timeRemaining);
  countdownInterval = setInterval(() => {
    timeRemaining -= 0.1;
    if (timeRemaining <= 0) {
      timeRemaining = 0;
      clearInterval(countdownInterval);
      setTimerState("finished");
      updateTimerTextAndArc(timeRemaining);
      disableScreenAwake();
      return;
    }
    updateTimerTextAndArc(timeRemaining);
  }, 100);
}


function updateTimerTextAndArc(remaining) {
    let fractionLeft = totalTime > 0 ? remaining / totalTime : 0;
    if (fractionLeft < 0) fractionLeft = 0;
    if (fractionLeft > 1) fractionLeft = 1;
  
    const angle = fractionLeft * 360;
    circleForeground.setAttribute("d", describeArc(100, 100, 90, angle));
    timerText.textContent = formatTime(remaining);
  }
  
  function formatTime(seconds) {
    if (seconds < 0) seconds = 0;
    const mm = Math.floor(seconds / 60);
    const ss = Math.floor(seconds % 60);
    return mm + ":" + ss.toString().padStart(2, "0");
  }
  
  function describeArc(cx, cy, r, angleDeg) {
    if (angleDeg <= 0) {
      return "";
    }
    if (angleDeg >= 360) {
      return `
        M ${cx} ${cy - r}
        A ${r} ${r} 0 1 1 ${cx - 0.01} ${cy - r}
        Z
      `;
    }
    const largeArcFlag = angleDeg > 180 ? 1 : 0;
    const sweepFlag = 1;
    const angleRad = (Math.PI / 180) * angleDeg;
  
    const startX = cx;
    const startY = cy - r;
    const endX = cx + r * Math.sin(angleRad);
    const endY = cy - r * Math.cos(angleRad);
  
    return `
      M ${cx} ${cy}
      L ${startX} ${startY}
      A ${r} ${r} 0 ${largeArcFlag} ${sweepFlag} ${endX} ${endY}
      Z
    `;
  }
  
  // Event Listeners
  refreshButton.addEventListener("click", () => {
    location.reload();
  });
  
  // Dark mode toggle => toggles class, saves preference
  darkModeToggle.addEventListener("change", (e) => {
    const isDark = e.target.checked;
    document.body.classList.toggle("dark-mode", isDark);
    localStorage.setItem(STORAGE_THEME_KEY, isDark);
  });
  
  // Tap the circle => Start/Pause/Resume
  circleArea.addEventListener("click", onCircleTap);
  
  // If user changes the dropdown while idle/finished
  minutesSelect.addEventListener("change", updateTimerFromDropdown);
  secondsSelect.addEventListener("change", updateTimerFromDropdown);
  
  // Initialize on page load
  init();