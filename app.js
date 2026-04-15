const state = {
  audioContext: null,
  sourceNode: null,
  compressor: null,
  makeupGain: null,
  dryGain: null,
  wetGain: null,
  masterGain: null,
  inputAnalyser: null,
  outputAnalyser: null,
  mediaRecorderDest: null,
  audioBlobUrl: "",
  compressedBlobUrl: "",
  currentFile: null,
  currentBuffer: null,
  bypass: false,
  rafId: 0,
  files: [],
};

const presets = {
  vocal: {
    threshold: -22,
    ratio: 3.5,
    attack: 0.005,
    release: 0.2,
    knee: 26,
    makeup: 3.5,
  },
  music: {
    threshold: -20,
    ratio: 2.5,
    attack: 0.01,
    release: 0.28,
    knee: 30,
    makeup: 2.5,
  },
  loudness: {
    threshold: -28,
    ratio: 6,
    attack: 0.003,
    release: 0.2,
    knee: 20,
    makeup: 6,
  },
  podcast: {
    threshold: -26,
    ratio: 3,
    attack: 0.008,
    release: 0.35,
    knee: 28,
    makeup: 4,
  },
  aggressive: {
    threshold: -35,
    ratio: 10,
    attack: 0.001,
    release: 0.15,
    knee: 8,
    makeup: 8,
  },
};

const controls = ["threshold", "ratio", "attack", "release", "knee", "makeup"];

const el = {
  audioInput: document.getElementById("audioInput"),
  dropZone: document.getElementById("dropZone"),
  fileList: document.getElementById("fileList"),
  audioPlayer: document.getElementById("audioPlayer"),
  applyBtn: document.getElementById("applyBtn"),
  downloadBtn: document.getElementById("downloadBtn"),
  playBtn: document.getElementById("playBtn"),
  bypassBtn: document.getElementById("bypassBtn"),
  seekBar: document.getElementById("seekBar"),
  currentTime: document.getElementById("currentTime"),
  duration: document.getElementById("duration"),
  volumeSlider: document.getElementById("volumeSlider"),
  inputCanvas: document.getElementById("inputCanvas"),
  outputCanvas: document.getElementById("outputCanvas"),
  grMeter: document.getElementById("grMeter"),
  grValue: document.getElementById("grValue"),
  presetGrid: document.getElementById("presetGrid"),
};

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return "00:00";
  const m = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const s = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${m}:${s}`;
}

function updateValueLabels() {
  const threshold = Number(document.getElementById("threshold").value);
  const ratio = Number(document.getElementById("ratio").value);
  const attack = Number(document.getElementById("attack").value);
  const release = Number(document.getElementById("release").value);
  const knee = Number(document.getElementById("knee").value);
  const makeup = Number(document.getElementById("makeup").value);

  document.getElementById("thresholdVal").textContent = `${threshold} dB`;
  document.getElementById("ratioVal").textContent = ratio.toFixed(1);
  document.getElementById("attackVal").textContent = `${attack.toFixed(3)} s`;
  document.getElementById("releaseVal").textContent = `${release.toFixed(2)} s`;
  document.getElementById("kneeVal").textContent = `${knee} dB`;
  document.getElementById("makeupVal").textContent = `${makeup.toFixed(1)} dB`;
}

async function ensureAudioGraph() {
  if (state.audioContext) return;

  state.audioContext = new (window.AudioContext || window.webkitAudioContext)();
  state.compressor = state.audioContext.createDynamicsCompressor();
  state.makeupGain = state.audioContext.createGain();
  state.dryGain = state.audioContext.createGain();
  state.wetGain = state.audioContext.createGain();
  state.masterGain = state.audioContext.createGain();
  state.inputAnalyser = state.audioContext.createAnalyser();
  state.outputAnalyser = state.audioContext.createAnalyser();
  state.mediaRecorderDest = state.audioContext.createMediaStreamDestination();

  state.inputAnalyser.fftSize = 2048;
  state.outputAnalyser.fftSize = 2048;

  applyParamsToNodes();
  state.masterGain.gain.value = Number(el.volumeSlider.value);

  state.dryGain.gain.value = 0;
  state.wetGain.gain.value = 1;

  state.makeupGain.connect(state.wetGain);
  state.compressor.connect(state.makeupGain);

  state.wetGain.connect(state.masterGain);
  state.dryGain.connect(state.masterGain);

  state.masterGain.connect(state.outputAnalyser);
  state.masterGain.connect(state.audioContext.destination);
  state.masterGain.connect(state.mediaRecorderDest);

  state.sourceNode = state.audioContext.createMediaElementSource(
    el.audioPlayer,
  );
  state.sourceNode.connect(state.inputAnalyser);
  state.sourceNode.connect(state.compressor);
  state.sourceNode.connect(state.dryGain);

  startVisualizerLoop();
}

function applyParamsToNodes() {
  if (!state.compressor || !state.makeupGain) return;

  state.compressor.threshold.value = Number(
    document.getElementById("threshold").value,
  );
  state.compressor.ratio.value = Number(document.getElementById("ratio").value);
  state.compressor.attack.value = Number(
    document.getElementById("attack").value,
  );
  state.compressor.release.value = Number(
    document.getElementById("release").value,
  );
  state.compressor.knee.value = Number(document.getElementById("knee").value);
  state.makeupGain.gain.value = Math.pow(
    10,
    Number(document.getElementById("makeup").value) / 20,
  );
}

function setBypass(on) {
  state.bypass = on;
  if (!state.dryGain || !state.wetGain) return;

  state.dryGain.gain.value = on ? 1 : 0;
  state.wetGain.gain.value = on ? 0 : 1;

  el.bypassBtn.classList.toggle("on", on);
  el.bypassBtn.textContent = on ? "Bypass On" : "Bypass Off";
  el.bypassBtn.setAttribute("aria-pressed", String(on));
}

function drawSpectrum(ctx, analyser, colorMain, colorGlow) {
  const width = ctx.canvas.width;
  const height = ctx.canvas.height;
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);

  ctx.clearRect(0, 0, width, height);

  const grad = ctx.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, colorGlow);
  grad.addColorStop(1, "rgba(0,0,0,0.08)");

  ctx.fillStyle = "rgba(4,8,19,0.45)";
  ctx.fillRect(0, 0, width, height);

  const bars = 120;
  const step = Math.floor(data.length / bars);
  const barWidth = Math.max(2, width / bars - 1.5);

  for (let i = 0; i < bars; i += 1) {
    const v = data[i * step] / 255;
    const barHeight = clamp(v * height * 1.15, 2, height - 2);
    const x = i * (barWidth + 1.5);
    const y = height - barHeight;

    ctx.fillStyle = grad;
    ctx.fillRect(x, y, barWidth, barHeight);
    ctx.fillStyle = colorMain;
    ctx.fillRect(x, y, barWidth, Math.max(2, barHeight * 0.12));
  }
}

function startVisualizerLoop() {
  const inputCtx = el.inputCanvas.getContext("2d");
  const outputCtx = el.outputCanvas.getContext("2d");

  function render() {
    if (state.inputAnalyser && state.outputAnalyser) {
      drawSpectrum(
        inputCtx,
        state.inputAnalyser,
        "rgba(0,216,255,0.9)",
        "rgba(0,216,255,0.35)",
      );
      drawSpectrum(
        outputCtx,
        state.outputAnalyser,
        "rgba(160,76,255,0.9)",
        "rgba(160,76,255,0.35)",
      );

      const reduction = Number(state.compressor.reduction || 0);
      const reductionAbs = Math.abs(reduction);
      const pct = clamp((reductionAbs / 24) * 100, 0, 100);
      el.grMeter.style.width = `${pct}%`;
      el.grValue.textContent = `${reduction.toFixed(1)} dB`;
    }

    state.rafId = requestAnimationFrame(render);
  }

  cancelAnimationFrame(state.rafId);
  render();
}

function renderFileList() {
  if (state.files.length === 0) {
    el.fileList.innerHTML = '<li class="file-empty">No file loaded yet</li>';
    return;
  }

  el.fileList.innerHTML = "";
  state.files.forEach((file, index) => {
    const li = document.createElement("li");
    li.textContent = file.name;
    if (file === state.currentFile) li.classList.add("active");
    li.title = `${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
    li.addEventListener("click", () => {
      loadFileFromList(index).catch((err) => {
        console.error(err);
        alert("Failed to load selected file.");
      });
    });
    el.fileList.appendChild(li);
  });
}

async function decodeToBuffer(file) {
  const arr = await file.arrayBuffer();
  const tempContext = new (window.AudioContext || window.webkitAudioContext)();
  try {
    return await tempContext.decodeAudioData(arr.slice(0));
  } finally {
    tempContext.close();
  }
}

async function loadFile(file) {
  if (!file) return;

  const allowed = [
    "audio/mpeg",
    "audio/wav",
    "audio/ogg",
    "audio/mp4",
    "audio/x-m4a",
    "audio/aac",
  ];
  const extAllowed = /\.(mp3|wav|ogg|m4a)$/i.test(file.name);

  if (!allowed.includes(file.type) && !extAllowed) {
    alert("Unsupported format. Use MP3, WAV, OGG, or M4A.");
    return;
  }

  if (!state.files.find((f) => f.name === file.name && f.size === file.size)) {
    state.files.push(file);
  }

  state.currentFile = file;
  renderFileList();

  if (state.audioBlobUrl) {
    URL.revokeObjectURL(state.audioBlobUrl);
  }

  state.audioBlobUrl = URL.createObjectURL(file);
  el.audioPlayer.src = state.audioBlobUrl;

  state.currentBuffer = await decodeToBuffer(file);
  el.applyBtn.disabled = false;
  el.downloadBtn.disabled = true;

  if (state.compressedBlobUrl) {
    URL.revokeObjectURL(state.compressedBlobUrl);
    state.compressedBlobUrl = "";
  }

  await ensureAudioGraph();
  if (state.audioContext.state === "suspended") {
    await state.audioContext.resume();
  }
}

async function loadFileFromList(index) {
  const file = state.files[index];
  await loadFile(file);
}

function bindEvents() {
  el.audioInput.addEventListener("change", async (event) => {
    const [file] = event.target.files;
    await loadFile(file);
  });

  ["dragenter", "dragover"].forEach((name) => {
    el.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      el.dropZone.classList.add("drag");
    });
  });

  ["dragleave", "drop"].forEach((name) => {
    el.dropZone.addEventListener(name, (event) => {
      event.preventDefault();
      el.dropZone.classList.remove("drag");
    });
  });

  el.dropZone.addEventListener("drop", async (event) => {
    const [file] = event.dataTransfer.files;
    await loadFile(file);
  });

  el.playBtn.addEventListener("click", async () => {
    if (!state.currentFile) return;
    await ensureAudioGraph();

    if (state.audioContext.state === "suspended") {
      await state.audioContext.resume();
    }

    if (el.audioPlayer.paused) {
      await el.audioPlayer.play();
      el.playBtn.textContent = "Pause";
    } else {
      el.audioPlayer.pause();
      el.playBtn.textContent = "Play";
    }
  });

  el.audioPlayer.addEventListener("pause", () => {
    el.playBtn.textContent = "Play";
  });

  el.audioPlayer.addEventListener("play", () => {
    el.playBtn.textContent = "Pause";
  });

  el.audioPlayer.addEventListener("loadedmetadata", () => {
    el.duration.textContent = formatTime(el.audioPlayer.duration);
    el.seekBar.value = "0";
  });

  el.audioPlayer.addEventListener("timeupdate", () => {
    const dur = el.audioPlayer.duration || 0;
    const cur = el.audioPlayer.currentTime || 0;
    el.currentTime.textContent = formatTime(cur);
    el.seekBar.value = dur > 0 ? ((cur / dur) * 100).toFixed(2) : "0";
  });

  el.seekBar.addEventListener("input", () => {
    const dur = el.audioPlayer.duration || 0;
    if (dur <= 0) return;
    el.audioPlayer.currentTime = (Number(el.seekBar.value) / 100) * dur;
  });

  el.volumeSlider.addEventListener("input", () => {
    if (state.masterGain) {
      state.masterGain.gain.value = Number(el.volumeSlider.value);
    }
  });

  el.bypassBtn.addEventListener("click", () => {
    setBypass(!state.bypass);
  });

  controls.forEach((id) => {
    const input = document.getElementById(id);
    input.addEventListener("input", () => {
      updateValueLabels();
      applyParamsToNodes();
    });
  });

  el.presetGrid.addEventListener("click", (event) => {
    const button = event.target.closest(".preset-btn");
    if (!button) return;

    const presetName = button.dataset.preset;
    const preset = presets[presetName];
    if (!preset) return;

    document
      .querySelectorAll(".preset-btn")
      .forEach((item) => item.classList.remove("active"));
    button.classList.add("active");

    document.getElementById("threshold").value = String(preset.threshold);
    document.getElementById("ratio").value = String(preset.ratio);
    document.getElementById("attack").value = String(preset.attack);
    document.getElementById("release").value = String(preset.release);
    document.getElementById("knee").value = String(preset.knee);
    document.getElementById("makeup").value = String(preset.makeup);

    updateValueLabels();
    applyParamsToNodes();
  });

  el.applyBtn.addEventListener("click", async () => {
    if (!state.currentBuffer) return;
    el.applyBtn.disabled = true;
    el.applyBtn.textContent = "Processing...";

    try {
      const blob = await renderCompressedBlob(state.currentBuffer, {
        threshold: Number(document.getElementById("threshold").value),
        ratio: Number(document.getElementById("ratio").value),
        attack: Number(document.getElementById("attack").value),
        release: Number(document.getElementById("release").value),
        knee: Number(document.getElementById("knee").value),
        makeup: Number(document.getElementById("makeup").value),
      });

      if (state.compressedBlobUrl) {
        URL.revokeObjectURL(state.compressedBlobUrl);
      }

      state.compressedBlobUrl = URL.createObjectURL(blob);
      el.downloadBtn.disabled = false;
      alert("Compression applied. Click Download to save WAV output.");
    } catch (err) {
      console.error(err);
      alert("Failed to apply compression.");
    } finally {
      el.applyBtn.disabled = false;
      el.applyBtn.textContent = "Apply Compression";
    }
  });

  el.downloadBtn.addEventListener("click", () => {
    if (!state.compressedBlobUrl || !state.currentFile) return;

    const link = document.createElement("a");
    const baseName = state.currentFile.name.replace(/\.[^.]+$/, "");
    link.href = state.compressedBlobUrl;
    link.download = `${baseName}-compressed.wav`;
    document.body.appendChild(link);
    link.click();
    link.remove();
  });

  window.addEventListener("beforeunload", () => {
    if (state.audioBlobUrl) URL.revokeObjectURL(state.audioBlobUrl);
    if (state.compressedBlobUrl) URL.revokeObjectURL(state.compressedBlobUrl);
    cancelAnimationFrame(state.rafId);
  });
}

async function renderCompressedBlob(buffer, params) {
  const offline = new OfflineAudioContext(
    buffer.numberOfChannels,
    buffer.length,
    buffer.sampleRate,
  );

  const src = offline.createBufferSource();
  src.buffer = buffer;

  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = params.threshold;
  compressor.ratio.value = params.ratio;
  compressor.attack.value = params.attack;
  compressor.release.value = params.release;
  compressor.knee.value = params.knee;

  const makeup = offline.createGain();
  makeup.gain.value = Math.pow(10, params.makeup / 20);

  src.connect(compressor);
  compressor.connect(makeup);
  makeup.connect(offline.destination);

  src.start(0);
  const rendered = await offline.startRendering();
  return audioBufferToWavBlob(rendered);
}

function audioBufferToWavBlob(buffer) {
  const numChannels = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const length = buffer.length;
  const bytesPerSample = 2;
  const blockAlign = numChannels * bytesPerSample;
  const dataSize = length * blockAlign;
  const arrayBuffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(arrayBuffer);

  function writeString(offset, str) {
    for (let i = 0; i < str.length; i += 1) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataSize, true);

  const channels = [];
  for (let ch = 0; ch < numChannels; ch += 1) {
    channels.push(buffer.getChannelData(ch));
  }

  let offset = 44;
  for (let i = 0; i < length; i += 1) {
    for (let ch = 0; ch < numChannels; ch += 1) {
      const sample = clamp(channels[ch][i], -1, 1);
      const intSample = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
      view.setInt16(offset, intSample, true);
      offset += 2;
    }
  }

  return new Blob([view], { type: "audio/wav" });
}

updateValueLabels();
bindEvents();
