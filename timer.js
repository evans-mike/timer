// ========== Wake Lock (Chrome) + NoSleep.js (iOS) ==========
let wakeLock = null;
let noSleep = new NoSleep();
let wakeLockSupported = "wakeLock" in navigator;

const startSound = new Audio('sounds/_start.mp3');
const finishSound = new Audio('sounds/finish.mp3');

// Function to play notification and vibrate
function notify(isStart = true) {
    // Play sound
    if (isStart) {
        startSound.play().catch(e => console.log('Audio play failed:', e));
    } else {
        finishSound.play().catch(e => console.log('Audio play failed:', e));
    }
    
    // Vibrate if supported (mobile devices)
    if (navigator.vibrate) {
        if (isStart) {
            navigator.vibrate(200); // Single vibration for start
        } else {
            navigator.vibrate([200, 100, 200]); // Pattern for finish: vibrate-pause-vibrate
        }
    }
}

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
  light: {
    idle: "#EF5350", // A soft, muted red
    running: "#4CAF50", // A soft, muted green
    paused: "#FFA726", // A warm, muted amber
    finished: "#EF5350", // A soft, muted red
  },
  dark: {
    idle: "#E57373", // A lighter red for dark mode
    running: "#81C784", // A lighter, more visible green for dark mode
    paused: "#FFB74D", // A lighter amber for dark mode
    finished: "#E57373", // A lighter red for dark mode
  },
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
const circleBackground = document.getElementById("circleBackground");
const body = document.body;

darkModeToggle.addEventListener("change", () => {
  if (darkModeToggle.checked) {
    body.classList.add("dark-mode");
    circleBackground.setAttribute("fill", "#222");
  } else {
    body.classList.remove("dark-mode");
    circleBackground.setAttribute("fill", "#EAEAEA");
  }
  // Update current state color for new theme
  setTimerState(timerState);
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
    circleBackground.setAttribute("fill", "#222"); // Set dark background on init
  } else {
    circleBackground.setAttribute("fill", "#EAEAEA"); // Set light background on init
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
    timerState = newState;
    const isDarkMode = document.body.classList.contains('dark-mode');
    const themeColors = isDarkMode ? stateColors.dark : stateColors.light;
    
    // Add notification when changing to running state
    if (newState === "running") {
        notify(true);
    }
    
    const circleForeground = document.getElementById('circleForeground');
    const circleBackground = document.getElementById('circleBackground');
    
    // Set the color
    circleForeground.setAttribute("fill", themeColors[newState]);
    
    if (newState === "finished") {
      // Move background behind foreground for finished state
      circleBackground.parentNode.insertBefore(circleForeground, circleBackground);
      circleForeground.setAttribute("d", describeArc(100, 100, 90, 360));
    } else {
      // Move foreground in front of background for all other states
      circleBackground.parentNode.insertBefore(circleBackground, circleForeground);
    }
    
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
  if (timerState === "finished") {
    // When finished, tapping should return to idle state
    setTimerState("idle");
    updateTimerFromDropdown();
    updateTimerTextAndArc(timeRemaining);
  } else if (timerState === "idle") {
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
        notify(false);
        
        // Move circles and set finished state
        const isDarkMode = document.body.classList.contains('dark-mode');
        const finishedColor = isDarkMode ? stateColors.dark.finished : stateColors.light.finished;
        
        const circleForeground = document.getElementById('circleForeground');
        const circleBackground = document.getElementById('circleBackground');
        
        // Move background behind foreground
        circleBackground.parentNode.insertBefore(circleForeground, circleBackground);
        
        circleForeground.setAttribute("fill", finishedColor);
        circleForeground.setAttribute("d", describeArc(100, 100, 90, 360));
        
        setTimerState("finished");
        updateTimerTextAndArc(0);
        disableScreenAwake();
        return;
      }
      updateTimerTextAndArc(timeRemaining);
    }, 100);
  }

function updateTimerTextAndArc(timeLeft) {
  // Update timer text
  const minutes = Math.floor(timeLeft / 60);
  const seconds = Math.floor(timeLeft % 60);
  timerText.textContent = `${String(minutes).padStart(2, "0")}:${String(
    seconds
  ).padStart(2, "0")}`;

  // Update arc
  const percentage = (timeLeft / (totalTime || 1)) * 100;
  const degrees = (percentage / 100) * 360;

  const circleForeground = document.getElementById("circleForeground");
  if (degrees > 0) {
    circleForeground.setAttribute("d", describeArc(100, 100, 90, degrees));
    circleForeground.style.display = "block";
  } else {
    circleForeground.style.display = "none";
  }
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
    // When timer is finished, draw a complete circle
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
minutesSelect.addEventListener("change", () => {
  if (timerState === "idle" || timerState === "finished") {
    updateTimerFromDropdown();
  } else {
    // If timer is running or paused, reset to idle with new time
    clearInterval(countdownInterval);
    disableScreenAwake();
    setTimerState("idle");
    updateTimerFromDropdown();
    updateTimerTextAndArc(timeRemaining);
  }
});

secondsSelect.addEventListener("change", () => {
  if (timerState === "idle" || timerState === "finished") {
    updateTimerFromDropdown();
  } else {
    // If timer is running or paused, reset to idle with new time
    clearInterval(countdownInterval);
    disableScreenAwake();
    setTimerState("idle");
    updateTimerFromDropdown();
    updateTimerTextAndArc(timeRemaining);
  }
});


// Initialize on page load
init();
