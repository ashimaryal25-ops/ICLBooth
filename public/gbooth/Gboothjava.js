let liveFilter = "none";

// Access Base UI Panel Containers
const video = document.getElementById("webcam");
const startButton = document.getElementById("start-btn");

const viewHome = document.getElementById("view-home");
const viewLayout = document.getElementById("view-layout");
const viewCamera = document.getElementById("view-camera");
const viewDecor = document.getElementById("view-decor");
const viewFinal = document.getElementById("view-final");

// Camera Module Elements
const boothCamStream = document.getElementById("booth-cam-stream");
const countdownOverlay = document.getElementById("countdown-overlay");
const previewGrid = document.getElementById("photo-preview-grid");
const retakeBtn = document.getElementById("retake-btn");
const continueBtn = document.getElementById("continue-btn");

// Decoration Suite Elements
const decorCanvas = document.getElementById("decor-strip-canvas");
const decorCtx = decorCanvas.getContext("2d");
const decorColorWheel = document.getElementById("decor-color-wheel");
const masterSubmitBtn = document.getElementById("decor-master-submit-btn");

// Final Screen Elements
const finalStripCanvas = document.getElementById("final-strip-canvas");
const finalCountdownSpan = document.getElementById("final-countdown");
const printBtn = document.getElementById("print-btn");
const homeBtn = document.getElementById("home-btn");
const qrCodeDiv = document.getElementById("qr-code");

// Global Configuration States
let chosenSlots = 4;
let capturedPhotosList = []; // Stores the raw, unfiltered canvas snapshots securely
let countdownTimerInterval = null;

// Final Screen Timer Configuration States
let finalTimerInterval = null;
let secondsRemaining = 30;

const STRIP_W = 360;
const STRIP_H = 960;
const STRIP_PADDING_X = 24;

let stripBackgroundColor = "#EB9AB2";
let activePlacedStickers = [];
let selectedStickerRef = null;
let stickerDragOffset = { x: 0, y: 0 };

// Global reference variable for the dynamic QRCode object
let qrCodeGeneratorInstance = null;

const gettysburgQRImage = new Image();
gettysburgQRImage.src =
  "https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=" +
  encodeURIComponent("https://icl.sites.gettysburg.edu/");

gettysburgQRImage.onload = () => {
  if (!viewDecor.classList.contains("hidden")) {
    renderPhotoStripCanvas();
  }
};

function startCamera(videoTarget) {
  if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 }, audio: false })
      .then(function (stream) {
        videoTarget.srcObject = stream;
      })
      .catch(function (error) {
        console.error("Webcam matrix configuration streaming failed: ", error);
      });
  }
}

// Home screen event navigation
startButton.addEventListener("click", () => {
  viewHome.classList.add("hidden");
  viewLayout.classList.remove("hidden");
});

// Layout grid event navigation maps to individual slot counts
document.querySelectorAll(".layout-card").forEach((card) => {
  const selectButton = card.querySelector(".cut-btn");
  if (selectButton) {
    selectButton.addEventListener("click", () => {
      chosenSlots = parseInt(card.getAttribute("data-slots"));

      viewLayout.classList.add("hidden");
      viewCamera.classList.remove("hidden");

      startCamera(boothCamStream);
      initializePhotoboothSession();
    });
  }
});

// Map HTML data-filter keys to precise, Safari-safe canvas filter configurations
function getCanvasFilterString(filterName) {
  switch (filterName) {
    case "traditional":
      return "grayscale(100%) contrast(120%) brightness(103%)";
    case "sepia":
      return "sepia(75%) saturate(115%) contrast(105%)";
    case "soft":
      return "brightness(114%) contrast(92%) saturate(108%)";
    case "y2k":
      return "contrast(120%) brightness(108%) saturate(50%) hue-rotate(-8deg)";
    case "vivid":
      return "contrast(112%) saturate(170%) brightness(104%)";
    case "none":
    default:
      return "none";
  }
}

function initializePhotoboothSession() {
  capturedPhotosList = [];
  previewGrid.innerHTML = "";
  retakeBtn.classList.add("hidden");
  continueBtn.classList.add("hidden");

  if (chosenSlots === 2) {
    previewGrid.style.gridTemplateColumns = "1fr";
    previewGrid.style.maxWidth = "240px";
  } else {
    previewGrid.style.gridTemplateColumns = "repeat(2, 1fr)";
    previewGrid.style.maxWidth = "100%";
  }

  for (let i = 0; i < chosenSlots; i++) {
    const slotBox = document.createElement("div");
    slotBox.className = "preview-box-slot";
    slotBox.id = `capture-preview-${i}`;
    previewGrid.appendChild(slotBox);
  }

  triggerNextPhotoSequence();
}

function triggerNextPhotoSequence() {
  let timeLeft = 5;
  countdownOverlay.innerText = timeLeft;
  countdownOverlay.classList.remove("hidden");

  countdownTimerInterval = setInterval(() => {
    timeLeft--;
    if (timeLeft > 0) {
      countdownOverlay.innerText = timeLeft;
    } else {
      clearInterval(countdownTimerInterval);
      countdownOverlay.classList.add("hidden");

      snapFramePhoto();

      if (capturedPhotosList.length < chosenSlots) {
        setTimeout(triggerNextPhotoSequence, 1200);
      } else {
        retakeBtn.classList.remove("hidden");
        continueBtn.classList.remove("hidden");
      }
    }
  }, 1000);
}

function snapFramePhoto() {
  const targetIndex = capturedPhotosList.length;

  const rawCanvas = document.createElement("canvas");
  rawCanvas.width = 640;
  rawCanvas.height = 480;
  const rawCtx = rawCanvas.getContext("2d");
  rawCtx.drawImage(boothCamStream, 0, 0, rawCanvas.width, rawCanvas.height);

  capturedPhotosList.push(rawCanvas);

  const currentFrameSlot = document.getElementById(
    `capture-preview-${targetIndex}`,
  );
  if (currentFrameSlot) {
    const previewCanvas = document.createElement("canvas");
    previewCanvas.width = 640;
    previewCanvas.height = 480;
    currentFrameSlot.appendChild(previewCanvas);

    const ctx = previewCanvas.getContext("2d");
    ctx.drawImage(rawCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
  }
}

retakeBtn.addEventListener("click", () => {
  clearInterval(countdownTimerInterval);
  initializePhotoboothSession();
});

window.addEventListener("DOMContentLoaded", () => {
  startCamera(video);
});

if (continueBtn) {
  continueBtn.addEventListener("click", () => {
    viewCamera.classList.add("hidden");
    viewDecor.classList.remove("hidden");
    renderPhotoStripCanvas();
  });
}

function renderPhotoStripCanvas() {
  decorCanvas.width = STRIP_W;
  decorCanvas.height = STRIP_H;

  decorCtx.fillStyle = stripBackgroundColor;
  decorCtx.fillRect(0, 0, STRIP_W, STRIP_H);

  const slotCount = capturedPhotosList.length;
  const photoW = STRIP_W - STRIP_PADDING_X * 2;

  let photoH = photoW * 0.75;
  let topOffsetMargin = 24;
  let gapSpacingValue = 16;

  if (slotCount === 2) {
    photoH = photoW * 0.78;
    topOffsetMargin = 70;
    gapSpacingValue = 50;
  } else if (slotCount === 3) {
    photoH = photoW * 0.78;
    topOffsetMargin = 40;
    gapSpacingValue = 22;
  } else if (slotCount === 4) {
    photoH = photoW * 0.62;
    topOffsetMargin = 16;
    gapSpacingValue = 10;
  }

  for (let i = 0; i < slotCount; i++) {
    const targetY = topOffsetMargin + i * (photoH + gapSpacingValue);

    decorCtx.save();
    const x = STRIP_PADDING_X;
    const y = targetY;

    // Clip so filters never affect the layout frame boundaries
    decorCtx.beginPath();
    decorCtx.rect(x, y, photoW, photoH);
    decorCtx.clip();

    decorCtx.filter = getCanvasFilterString(liveFilter);

    // Mirror the image
    decorCtx.translate(x + photoW, y);
    decorCtx.scale(-1, 1);
    decorCtx.drawImage(capturedPhotosList[i], 0, 0, photoW, photoH);
    decorCtx.restore();
  }

  // Draw Footer Brand Assets
  decorCtx.fillStyle = "#ffffff";
  decorCtx.font = "900 16px sans-serif";
  decorCtx.textAlign = "center";
  decorCtx.letterSpacing = "2px";
  decorCtx.fillText("GETTYSBURG COLLEGE", STRIP_W / 2, STRIP_H - 110);

  const targetQRLink = "https://icl.sites.gettysburg.edu/";
  if (
    gettysburgQRImage.src !==
    "https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=" +
      encodeURIComponent(targetQRLink)
  ) {
    gettysburgQRImage.src =
      "https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=" +
      encodeURIComponent(targetQRLink);
  }

  if (gettysburgQRImage.complete || gettysburgQRImage.width > 0) {
    const qrDisplaySize = 65;
    const qrX = STRIP_W - STRIP_PADDING_X - qrDisplaySize;
    const qrY = STRIP_H - 85;

    decorCtx.drawImage(
      gettysburgQRImage,
      qrX,
      qrY,
      qrDisplaySize,
      qrDisplaySize,
    );
  }

  decorCtx.save();
  activePlacedStickers.forEach((stk) => {
    decorCtx.font = `${stk.size}px Arial`;
    decorCtx.textBaseline = "middle";
    decorCtx.textAlign = "center";
    decorCtx.fillText(stk.emoji, stk.x, stk.y);
  });
  decorCtx.restore();
}

// Track circular button palette additions
document.querySelectorAll(".preset-color-circle-btn").forEach((box) => {
  box.addEventListener("click", () => {
    stripBackgroundColor = box.getAttribute("data-color");
    renderPhotoStripCanvas();
  });
});

if (decorColorWheel) {
  decorColorWheel.addEventListener("input", (e) => {
    stripBackgroundColor = e.target.value;
    renderPhotoStripCanvas();
  });
}

document.querySelectorAll(".filter-action-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".filter-action-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    liveFilter = btn.getAttribute("data-filter");
    renderPhotoStripCanvas();
  });
});

function getCanvasCoordinates(e) {
  const boundingBox = decorCanvas.getBoundingClientRect();
  return {
    x: ((e.clientX - boundingBox.left) / boundingBox.width) * decorCanvas.width,
    y:
      ((e.clientY - boundingBox.top) / boundingBox.height) * decorCanvas.height,
  };
}

decorCanvas.addEventListener("pointerdown", (e) => {
  const mousePos = getCanvasCoordinates(e);
  selectedStickerRef = null;
  for (let i = activePlacedStickers.length - 1; i >= 0; i--) {
    const stk = activePlacedStickers[i];
    const dist = Math.sqrt(
      (mousePos.x - stk.x) ** 2 + (mousePos.y - stk.y) ** 2,
    );
    if (dist < stk.size / 1.2) {
      selectedStickerRef = stk;
      stickerDragOffset.x = mousePos.x - stk.x;
      stickerDragOffset.y = mousePos.y - stk.y;
      decorCanvas.setPointerCapture(e.pointerId);
      break;
    }
  }
});

decorCanvas.addEventListener("pointermove", (e) => {
  if (!selectedStickerRef) return;
  const mousePos = getCanvasCoordinates(e);
  selectedStickerRef.x = mousePos.x - stickerDragOffset.x;
  selectedStickerRef.y = mousePos.y - stickerDragOffset.y;
  renderPhotoStripCanvas();
});

decorCanvas.addEventListener("pointerup", (e) => {
  if (selectedStickerRef) {
    decorCanvas.releasePointerCapture(e.pointerId);
    selectedStickerRef = null;
  }
});

document.querySelectorAll(".draggable-emoji-source").forEach((emojiEl) => {
  emojiEl.addEventListener("click", () => {
    activePlacedStickers.push({
      id: Date.now() + Math.random(),
      emoji: emojiEl.innerText,
      x: STRIP_W / 2,
      y: STRIP_H / 2,
      size: 45,
    });
    renderPhotoStripCanvas();
  });
});

// ============================================================================
// FINAL STAGE PROCESSORS (QR Engine, Double Printing, & Timers)
// ============================================================================
if (masterSubmitBtn) {
  masterSubmitBtn.addEventListener("click", () => {
    viewDecor.classList.add("hidden");
    viewFinal.classList.remove("hidden");

    // 1. Render Final Preview Canvas Strip
    finalStripCanvas.width = STRIP_W;
    finalStripCanvas.height = STRIP_H;
    const finalCtx = finalStripCanvas.getContext("2d");
    finalCtx.drawImage(decorCanvas, 0, 0);

    // 2. Generate Unique Dynamic QR Code URL for direct download access
    qrCodeDiv.innerHTML = "";

    // Creates a completely unique, timestamp-hashed URL reference sequence
    const uniqueSessionToken =
      Date.now() + "_" + Math.floor(Math.random() * 1000);
    const downloadURL = `https://icl.sites.gettysburg.edu/download?session=${uniqueSessionToken}`;

    qrCodeGeneratorInstance = new QRCode(qrCodeDiv, {
      text: downloadURL,
      width: 180,
      height: 180,
      colorDark: "#000000",
      colorLight: "#ffffff",
      correctLevel: QRCode.CorrectLevel.H,
    });

    // Save final rendered strip data to server here if your project has a backend:
    // uploadPhotoStrip(uniqueSessionToken, decorCanvas.toDataURL("image/png"));

    // 3. Initiate Countdown Auto-reset Engine
    launchFinalCountdown();
  });
}

function launchFinalCountdown() {
  clearInterval(finalTimerInterval);
  secondsRemaining = 30;
  finalCountdownSpan.innerText = secondsRemaining;

  finalTimerInterval = setInterval(() => {
    secondsRemaining--;
    finalCountdownSpan.innerText = secondsRemaining;

    if (secondsRemaining <= 0) {
      clearInterval(finalTimerInterval);
      resetToDefaultHomeView();
    }
  }, 1000);
}

// Reset application state safely
function resetToDefaultHomeView() {
  clearInterval(finalTimerInterval);
  clearInterval(countdownTimerInterval);

  // Release camera
  if (boothCamStream.srcObject) {
    boothCamStream.srcObject.getTracks().forEach((track) => track.stop());
    boothCamStream.srcObject = null;
  }

  // Clear states
  capturedPhotosList = [];
  activePlacedStickers = [];
  liveFilter = "none";
  stripBackgroundColor = "#EB9AB2";

  // Navigation Panel Handlers
  viewFinal.classList.add("hidden");
  viewDecor.classList.add("hidden");
  viewCamera.classList.add("hidden");
  viewLayout.classList.add("hidden");
  viewHome.classList.remove("hidden");

  startCamera(video);
}

// Manual Navigation Buttons
homeBtn.addEventListener("click", resetToDefaultHomeView);

// ==========================================
// PHYSICAL PRINTER PRINT ACTION CONTROLLER
// ==========================================
printBtn.addEventListener("click", () => {
  // Convert Canvas into an Image Base64 Stream
  const rawImageStream = decorCanvas.toDataURL("image/png");

  const printSpooler = document.getElementById("print-window-container");
  printSpooler.innerHTML = `
    <div class="print-page-instance"><img src="${rawImageStream}" /></div>
    <div class="print-page-instance"><img src="${rawImageStream}" /></div>
  `;

  // Spool print buffer automatically
  window.print();
});

// ============================================================================
// BACK NAVIGATION ENGINE
// ============================================================================
const backToHomeBtn = document.getElementById("back-to-home");
const backToLayoutBtn = document.getElementById("back-to-layout");
const backToCameraBtn = document.getElementById("back-to-camera");

if (backToHomeBtn) {
  backToHomeBtn.addEventListener("click", () => {
    viewLayout.classList.add("hidden");
    viewHome.classList.remove("hidden");
  });
}

if (backToLayoutBtn) {
  backToLayoutBtn.addEventListener("click", () => {
    clearInterval(countdownTimerInterval);
    countdownOverlay.classList.add("hidden");

    if (boothCamStream.srcObject) {
      boothCamStream.srcObject.getTracks().forEach((track) => track.stop());
      boothCamStream.srcObject = null;
    }

    viewCamera.classList.add("hidden");
    viewLayout.classList.remove("hidden");
  });
}

if (backToCameraBtn) {
  backToCameraBtn.addEventListener("click", () => {
    viewDecor.classList.add("hidden");
    viewCamera.classList.remove("hidden");
    startCamera(boothCamStream);
  });
}
