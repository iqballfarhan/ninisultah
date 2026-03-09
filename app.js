// Minimal WebAudio-based backsound (no external audio files)
let audioCtx = null;
let masterGain = null;
let isPlaying = false;
let scheduled = [];
let audioElement = null;
let audioSourceNode = null;
let confettiSession = null;
const CONFETTI_PLAY_DURATION = 6500;
const CONFETTI_REPLAY_DELAY = 3000;
const CONFETTI_FADE_DURATION = 700;

const notes = [
  {f: 523.25, d: 0.45}, // C5
  {f: 659.25, d: 0.45}, // E5
  {f: 783.99, d: 0.45}, // G5
  {f: 1046.5, d: 0.7}, // C6
];

function ensureAudio(){
  if (!audioCtx){
    console.log('[audio] creating AudioContext');
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    masterGain = audioCtx.createGain();
    masterGain.gain.value = parseFloat(document.getElementById('volume').value || '0.6');
    masterGain.connect(audioCtx.destination);
    console.log('[audio] masterGain initialized, volume=', masterGain.gain.value, 'state=', audioCtx.state);
    // If there's an <audio> element with a src, connect it to the AudioContext so
    // we can control its volume via masterGain and obey resume policies.
    audioElement = document.getElementById('bgAudio');
    if (audioElement && audioElement.getAttribute('src')){
      try{
        audioSourceNode = audioCtx.createMediaElementSource(audioElement);
        audioSourceNode.connect(masterGain);
        console.log('[audio] media element source connected for', audioElement.getAttribute('src'));
      }catch(e){
        console.warn('[audio] could not createMediaElementSource:', e);
        audioSourceNode = null;
      }
    }
  }
}

function scheduleLoop(){
  if (!audioCtx) return;
  const start = audioCtx.currentTime + 0.05;
  console.log('[audio] scheduleLoop starting at', start);
  let t = start;
  for (let i=0;i<notes.length;i++){
    const n = notes[i];
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = n.f;
    console.log('[audio] scheduling note', i, 'freq=', n.f, 'dur=', n.d, 'at', t.toFixed(3));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.12, t+0.01);
    g.gain.linearRampToValueAtTime(0.0, t + n.d - 0.03);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + n.d);
    scheduled.push(osc);
    t += n.d;
  }
  // schedule repeating call
  const total = t - start;
  const id = setTimeout(()=>{
    if (isPlaying) scheduleLoop();
  }, total*1000 - 10);
  scheduled.push({_timeout:id});
}

function startMusic(){
  if (isPlaying) return;
  ensureAudio();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  console.log('[audio] startMusic called; audioCtx.state=', audioCtx.state);
  isPlaying = true;
  // Prefer playing local MP3 from assets; fall back to synth only if play fails.
  const src = audioElement && audioElement.getAttribute('src');
  if (src){
    const sourceLabel = document.getElementById('audioSource');
    sourceLabel && (sourceLabel.textContent = 'Sumber audio: file lokal (assets)');
    audioElement.play().then(()=>{
      console.log('[audio] playing media element');
      document.getElementById('playBtn').textContent = 'Playing...';
    }).catch((err)=>{
      console.warn('[audio] media play failed, falling back to synth:', err);
      sourceLabel && (sourceLabel.textContent = 'Sumber audio: synth (gagal putar file)');
      scheduleLoop();
      document.getElementById('playBtn').textContent = 'Playing...';
    });
  } else {
    // no src given — use synth
    document.getElementById('audioSource') && (document.getElementById('audioSource').textContent = 'Sumber audio: synth (tidak ada file)');
    scheduleLoop();
    document.getElementById('playBtn').textContent = 'Playing...';
  }
}

function stopMusic(){
  isPlaying = false;
  // stop oscillators
  console.log('[audio] stopMusic called; scheduled count=', scheduled.length);
  for (const s of scheduled){
    // Avoid using instanceof (can fail across realms). Stop anything with a stop() function.
    if (s && typeof s.stop === 'function'){
      try{ s.stop(); }catch(e){ /* ignore if already stopped */ }
    } else if (s && s._timeout) {
      clearTimeout(s._timeout);
    }
  }
  scheduled = [];
  // Pause/reset media element if present
  if (audioElement && !audioElement.paused){
    try{ audioElement.pause(); audioElement.currentTime = 0; console.log('[audio] paused media element'); }catch(e){}
  }
  document.getElementById('playBtn').textContent = 'Play Music';
}

// confetti
function runConfetti(){
  const canvas = document.getElementById('confettiCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  if (confettiSession){
    cancelAnimationFrame(confettiSession.rafId);
    clearTimeout(confettiSession.stopId);
    clearTimeout(confettiSession.restartId);
    window.removeEventListener('resize', confettiSession.onResize);
    if (window.visualViewport){
      window.visualViewport.removeEventListener('resize', confettiSession.onResize);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    confettiSession = null;
  }

  const colors = ['#ff6b6b', '#ffd93d', '#6bf0c3', '#6b8bff', '#d46bff'];
  const pieces = [];
  const pieceCount = 150;
  const edgePadding = 46;
  let w = 0;
  let h = 0;
  let previousTime = performance.now();
  let smoothedDelta = 1;
  let cycleStartedAt = performance.now();

  const randomBetween = (min, max)=> min + Math.random() * (max - min);

  const createPiece = ()=>{
    const width = randomBetween(5, 10);
    const height = randomBetween(10, 18);
    return {
      x: randomBetween(-edgePadding, w + edgePadding),
      y: randomBetween(-h - edgePadding, -edgePadding),
      w: width,
      h: height,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: randomBetween(-1.0, 1.0),
      vy: randomBetween(1.15, 2.9),
      rotation: randomBetween(0, Math.PI * 2),
      spin: randomBetween(-0.13, 0.13),
      waveOffset: randomBetween(0, Math.PI * 2),
    };
  };

  const refillPieces = ()=>{
    pieces.length = 0;
    for (let i = 0; i < pieceCount; i += 1){
      pieces.push(createPiece());
    }
  };

  const resizeCanvas = ()=>{
    const viewportWidth = Math.round(window.visualViewport?.width || window.innerWidth || 0);
    const viewportHeight = Math.round(window.visualViewport?.height || window.innerHeight || 0);
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));

    w = Math.max(320, viewportWidth);
    h = Math.max(320, viewportHeight);

    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    canvas.style.width = `${w}px`;
    canvas.style.height = `${h}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };

  const confettiState = {
    rafId: 0,
    stopId: 0,
    restartId: 0,
    onResize: ()=>{
      resizeCanvas();
    },
  };

  const draw = (now)=>{
    if (confettiSession !== confettiState) return;

    const rawDelta = Math.min(40, now - previousTime) / 16.666;
    smoothedDelta = (smoothedDelta * 0.84) + (rawDelta * 0.16);
    previousTime = now;

    const elapsed = now - cycleStartedAt;
    const remaining = CONFETTI_PLAY_DURATION - elapsed;
    let opacity = 1;
    if (elapsed < CONFETTI_FADE_DURATION){
      opacity = elapsed / CONFETTI_FADE_DURATION;
    } else if (remaining < CONFETTI_FADE_DURATION){
      opacity = Math.max(0, remaining / CONFETTI_FADE_DURATION);
    }

    ctx.clearRect(0, 0, w, h);
    ctx.globalAlpha = opacity;

    for (const piece of pieces){
      const sway = Math.sin(now * 0.0026 + piece.waveOffset) * 0.3;
      piece.x += (piece.vx + sway) * smoothedDelta;
      piece.y += piece.vy * smoothedDelta;
      piece.rotation += piece.spin * smoothedDelta;

      if (piece.x < -edgePadding) piece.x = w + edgePadding;
      if (piece.x > w + edgePadding) piece.x = -edgePadding;
      if (piece.y > h + edgePadding){
        Object.assign(piece, createPiece());
      }

      const flip = 0.55 + Math.abs(Math.cos(now * 0.009 + piece.waveOffset)) * 0.75;
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotation);
      ctx.scale(1, flip);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      ctx.restore();
    }

    ctx.globalAlpha = 1;
    confettiState.rafId = requestAnimationFrame(draw);
  };

  const stopCycle = ()=>{
    if (confettiSession !== confettiState) return;
    cancelAnimationFrame(confettiState.rafId);
    confettiState.rafId = 0;
    ctx.clearRect(0, 0, w, h);
    confettiState.restartId = setTimeout(()=>{
      if (confettiSession !== confettiState) return;
      startCycle();
    }, CONFETTI_REPLAY_DELAY);
  };

  const startCycle = ()=>{
    if (confettiSession !== confettiState) return;
    cycleStartedAt = performance.now();
    previousTime = cycleStartedAt;
    smoothedDelta = 1;
    refillPieces();
    confettiState.rafId = requestAnimationFrame(draw);
    confettiState.stopId = setTimeout(stopCycle, CONFETTI_PLAY_DURATION);
  };

  resizeCanvas();
  window.addEventListener('resize', confettiState.onResize, { passive: true });
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', confettiState.onResize, { passive: true });
  }

  confettiSession = confettiState;
  startCycle();
}

function setupPhotoSlider(){
  const slides = Array.from(document.querySelectorAll('.photo-frame .photo'));
  const prevBtn = document.getElementById('prevSlide');
  const nextBtn = document.getElementById('nextSlide');
  if (!slides.length || !prevBtn || !nextBtn) return;

  let currentIndex = 0;
  let autoSlideTimer = null;

  function showSlide(index){
    slides.forEach((slide, i)=>{
      slide.classList.toggle('is-active', i === index);
    });
  }

  function nextSlide(){
    currentIndex = (currentIndex + 1) % slides.length;
    showSlide(currentIndex);
  }

  function prevSlide(){
    currentIndex = (currentIndex - 1 + slides.length) % slides.length;
    showSlide(currentIndex);
  }

  function restartAutoSlide(){
    if (autoSlideTimer) clearInterval(autoSlideTimer);
    autoSlideTimer = setInterval(()=>{
      nextSlide();
    }, 3000);
  }

  prevBtn.addEventListener('click', ()=>{
    prevSlide();
    restartAutoSlide();
  });

  nextBtn.addEventListener('click', ()=>{
    nextSlide();
    restartAutoSlide();
  });

  document.addEventListener('visibilitychange', ()=>{
    if (document.hidden){
      if (autoSlideTimer) clearInterval(autoSlideTimer);
      autoSlideTimer = null;
      return;
    }
    restartAutoSlide();
  });

  showSlide(currentIndex);
  restartAutoSlide();
}

function setupMemoryGalleryTemplate(){
  const memoryGrid = document.getElementById('memoryGrid');
  const sliderPhotos = Array.from(document.querySelectorAll('.photo-frame .photo'));
  if (!memoryGrid || !sliderPhotos.length) return;

  const cards = sliderPhotos.map((img, index)=>{
    const card = document.createElement('article');
    card.className = 'memory-card reveal';

    const photo = document.createElement('img');
    photo.className = 'memory-image';
    const fullSrc = img.dataset.originalSrc || img.getAttribute('src') || img.currentSrc || img.src || '';
    photo.src = fullSrc;
    if (fullSrc) photo.dataset.fullSrc = fullSrc;
    photo.alt = img.getAttribute('alt') || `Foto ${index + 1}`;
    photo.loading = 'lazy';
    photo.decoding = 'async';

    const caption = document.createElement('p');
    caption.className = 'memory-caption';
    // caption.textContent = ` Ninis ${index + 1}`;

    card.append(photo, caption);
    return card;
  });

  memoryGrid.replaceChildren(...cards);
}

function setupScrollReveal(){
  const revealItems = Array.from(document.querySelectorAll('.reveal'));
  if (!revealItems.length) return;

  document.body.classList.add('js-reveal');

  const showAll = ()=>{
    revealItems.forEach((item)=> item.classList.add('is-visible'));
  };

  if (!('IntersectionObserver' in window)){
    showAll();
    return;
  }

  const observer = new IntersectionObserver((entries)=>{
    entries.forEach((entry)=>{
      if (entry.isIntersecting){
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.01, rootMargin: '0px 0px -8% 0px' });

  revealItems.forEach((item)=> observer.observe(item));

  // Fallback: if mobile browser delays intersection events, reveal anyway.
  setTimeout(showAll, 1800);
}

function setupIntroGate(){
  const gate = document.getElementById('introGate');
  const cake = gate && gate.querySelector('.intro-cake');
  const subtitle = gate && gate.querySelector('.intro-subtitle');
  const signature = document.getElementById('introSignature');
  if (!gate || !cake) return;

  const INTRO_STEP = {
    REVEAL_MESSAGE: 0,
    ENTER_PAGE: 1,
  };
  let currentStep = INTRO_STEP.REVEAL_MESSAGE;

  const enterPage = ()=>{
    document.body.classList.remove('has-intro');
    document.body.classList.add('entered');
    setTimeout(()=>{
      gate.remove();
    }, 500);
  };

  cake.addEventListener('click', ()=>{
    if (currentStep === INTRO_STEP.REVEAL_MESSAGE){
      currentStep = INTRO_STEP.ENTER_PAGE;
      if (signature){
        signature.hidden = false;
        requestAnimationFrame(()=> signature.classList.add('show'));
      }
      if (subtitle) subtitle.textContent = 'Sekali lagi klik kuenya untuk masuk 💖';
      return;
    }
    enterPage();
    startMusic();
    runConfetti();
  });
}

function setupPhotoModal(){
  const modal = document.getElementById('photoModal');
  const modalImage = document.getElementById('photoModalImage');
  const closeBtn = document.getElementById('photoModalClose');
  if (!modal || !modalImage || !closeBtn) return;

  const openModal = (src, alt)=>{
    if (!src) return;
    modalImage.src = src;
    modalImage.alt = alt || 'Preview foto';
    modal.hidden = false;
    document.body.classList.add('modal-open');
  };

  const closeModal = ()=>{
    modal.hidden = true;
    modalImage.removeAttribute('src');
    document.body.classList.remove('modal-open');
  };

  document.addEventListener('click', (event)=>{
    const target = event.target;
    if (!(target instanceof Element)) return;

    const activeSlideImage = target.closest('.photo-frame .photo.is-active');
    const memoryImage = target.closest('.memory-image');
    if (activeSlideImage instanceof HTMLImageElement){
      const previewSrc = activeSlideImage.currentSrc || activeSlideImage.src;
      const fullSrc = activeSlideImage.dataset.originalSrc || previewSrc;
      openModal(previewSrc, activeSlideImage.alt);

      if (fullSrc && fullSrc !== previewSrc){
        const fullImage = new Image();
        fullImage.onload = ()=>{
          if (!modal.hidden) modalImage.src = fullSrc;
        };
        fullImage.src = fullSrc;
      }
      return;
    }

    if (memoryImage instanceof HTMLImageElement){
      const previewSrc = memoryImage.currentSrc || memoryImage.src;
      const fullSrc = memoryImage.dataset.fullSrc || previewSrc;
      openModal(previewSrc, memoryImage.alt);

      if (fullSrc && fullSrc !== previewSrc){
        const fullImage = new Image();
        fullImage.onload = ()=>{
          if (!modal.hidden) modalImage.src = fullSrc;
        };
        fullImage.src = fullSrc;
      }
    }
  });

  closeBtn.addEventListener('click', closeModal);
  modal.addEventListener('click', (event)=>{
    if (event.target === modal) closeModal();
  });
  document.addEventListener('keydown', (event)=>{
    if (event.key === 'Escape' && !modal.hidden) closeModal();
  });
}

function setupPageLoader(){
  const loader = document.getElementById('pageLoader');
  const loaderBar = document.getElementById('loaderBar');
  const loaderPercent = document.getElementById('loaderPercent');
  const loaderData = document.getElementById('loaderData');
  if (!loader || !loaderBar || !loaderPercent){
    document.body.classList.add('loaded');
    return Promise.resolve();
  }

  const loaderTitle = loader.querySelector('.loader-title');
  const setLoaderTitle = (text)=>{
    if (loaderTitle) loaderTitle.textContent = text;
  };
  const formatBytes = (bytes)=>{
    const safeBytes = Number.isFinite(bytes) && bytes > 0 ? bytes : 0;
    if (safeBytes < 1024) return `${safeBytes} B`;
    const units = ['KB', 'MB', 'GB'];
    let value = safeBytes / 1024;
    let unitIndex = 0;
    while (value >= 1024 && unitIndex < units.length - 1){
      value /= 1024;
      unitIndex += 1;
    }
    const precision = value >= 100 ? 0 : value >= 10 ? 1 : 2;
    return `${value.toFixed(precision)} ${units[unitIndex]}`;
  };

  let downloadedBytes = 0;
  let estimatedTotalBytes = 0;
  const setLoaderData = (loaded, total)=>{
    if (!loaderData) return;
    const downloadedLabel = formatBytes(downloadedBytes);
    const estimatedLabel = estimatedTotalBytes > 0 ? ` / ${formatBytes(estimatedTotalBytes)}` : '';
    loaderData.textContent = `${loaded} / ${total} resource • ${downloadedLabel}${estimatedLabel}`;
  };

  const sliderImages = Array.from(document.querySelectorAll('.photo-frame .photo'));
  sliderImages.forEach((img)=>{
    const originalSrc = img.getAttribute('src');
    if (originalSrc && !img.dataset.originalSrc) img.dataset.originalSrc = originalSrc;
  });

  const imageElements = Array.from(document.querySelectorAll('.photo-frame .photo, .end-photo'));
  const imageUrls = Array.from(new Set(imageElements.map((img)=> img.getAttribute('src')).filter(Boolean)));
  const audioEl = document.getElementById('bgAudio');
  const audioUrl = audioEl && audioEl.getAttribute('src');
  const resourceUrls = Array.from(new Set([...imageUrls, ...(audioUrl ? [audioUrl] : [])]));
  const resourceBlobUrls = new Map();

  const totalResources = Math.max(1, imageUrls.length + (audioUrl ? 1 : 0));
  let loadedResources = 0;
  let targetPercent = 0;
  let displayedPercent = 0;

  const renderProgress = ()=>{
    loaderBar.style.width = `${displayedPercent}%`;
    loaderPercent.textContent = `${displayedPercent}%`;
  };

  const animateProgressTimer = setInterval(()=>{
    if (displayedPercent < targetPercent){
      displayedPercent += 1;
      renderProgress();
    }
  }, 15);

  const markResourceLoaded = (sizeBytes = 0)=>{
    loadedResources += 1;
    downloadedBytes += Math.max(0, Number(sizeBytes) || 0);
    updateTargetProgress();
    setLoaderData(loadedResources, totalResources);
  };

  const estimateTotalResourceSize = ()=>{
    if (!resourceUrls.length){
      setLoaderData(loadedResources, totalResources);
      return Promise.resolve();
    }

    return Promise.all(resourceUrls.map((url)=>
      fetchWithTimeout(url, { method: 'HEAD', cache: 'force-cache' }, 8000)
        .then((res)=>{
          if (!res.ok) return 0;
          const contentLength = Number(res.headers.get('content-length'));
          return Number.isFinite(contentLength) && contentLength > 0 ? contentLength : 0;
        })
        .catch(()=> 0)
    )).then((sizes)=>{
      estimatedTotalBytes = sizes.reduce((sum, size)=> sum + size, 0);
      setLoaderData(loadedResources, totalResources);
    });
  };

  const fetchWithTimeout = (url, options = {}, timeoutMs = 20000)=>{
    const controller = new AbortController();
    const timeoutId = setTimeout(()=> controller.abort(), timeoutMs);
    return fetch(url, { ...options, signal: controller.signal })
      .finally(()=> clearTimeout(timeoutId));
  };

  const fetchBlobWithRetry = (url, retry = 1)=>{
    const attempt = (left)=> fetchWithTimeout(url, { cache: 'force-cache' }, 20000)
      .then((res)=>{
        if (!res.ok) throw new Error(`resource fetch failed: ${res.status}`);
        return res.blob();
      })
      .catch((err)=>{
        if (left <= 0) throw err;
        return attempt(left - 1);
      });
    return attempt(retry);
  };

  const warmImageFromBlob = (blobUrl)=> new Promise((resolve)=>{
    let done = false;
    const finish = ()=>{
      if (done) return;
      done = true;
      resolve();
    };

    const image = new Image();
    image.onload = finish;
    image.onerror = finish;
    image.src = blobUrl;
    if (image.complete) finish();
    setTimeout(finish, 5000);
  });

  const updateTargetProgress = ()=>{
    const nextTarget = Math.round((loadedResources / totalResources) * 100);
    targetPercent = Math.max(targetPercent, Math.min(100, nextTarget));
  };

  const loadAudioFirst = ()=>{
    if (!audioUrl){
      setLoaderData(loadedResources, totalResources);
      return Promise.resolve();
    }

    setLoaderTitle('Sabar ya, lagi download resource audio...');
    return fetchBlobWithRetry(audioUrl, 1)
      .then((audioBlob)=>{
        const audioBlobUrl = URL.createObjectURL(audioBlob);
        resourceBlobUrls.set(audioUrl, audioBlobUrl);
        if (audioEl){
          audioEl.src = audioBlobUrl;
          audioEl.preload = 'auto';
          audioEl.load();
        }
        markResourceLoaded(audioBlob.size);
      })
      .catch(()=>{
        markResourceLoaded();
      });
  };

  const loadImage = (url)=> fetchBlobWithRetry(url, 1)
    .then((imageBlob)=>{
      const imageBlobUrl = URL.createObjectURL(imageBlob);
      resourceBlobUrls.set(url, imageBlobUrl);
      return warmImageFromBlob(imageBlobUrl).then(()=> imageBlob.size);
    })
    .then((sizeBytes)=>{
      markResourceLoaded(sizeBytes);
    })
    .catch(()=>{
      markResourceLoaded();
    });

  targetPercent = 3;
  setLoaderTitle('Sabar ya, lagi hitung ukuran resource...');
  setLoaderData(loadedResources, totalResources);
  renderProgress();

  const loadImages = ()=>{
    setLoaderTitle('Sabar ya, lagi download resource foto...');
    if (!imageUrls.length){
      setLoaderData(loadedResources, totalResources);
      return Promise.resolve();
    }
    return Promise.all(imageUrls.map(loadImage)).then(()=>{
      imageElements.forEach((img)=>{
        const preloadSrc = img.getAttribute('src');
        const blobSrc = preloadSrc && resourceBlobUrls.get(preloadSrc);
        if (blobSrc){
          img.src = blobSrc;
          img.setAttribute('src', blobSrc);
        }
      });

      const decodePromises = imageElements.map((img)=>{
        if (!(img instanceof HTMLImageElement)) return Promise.resolve();
        if (typeof img.decode === 'function'){
          return img.decode().catch(()=>{});
        }
        if (img.complete) return Promise.resolve();
        return new Promise((resolve)=>{
          const finish = ()=>{
            img.removeEventListener('load', finish);
            img.removeEventListener('error', finish);
            resolve();
          };
          img.addEventListener('load', finish, { once: true });
          img.addEventListener('error', finish, { once: true });
          setTimeout(finish, 5000);
        });
      });

      return Promise.all(decodePromises);
    });
  };

  return estimateTotalResourceSize().catch(()=>{}).then(()=> loadAudioFirst()).then(()=> loadImages()).then(()=>{
    loadedResources = totalResources;
    setLoaderData(loadedResources, totalResources);
    targetPercent = 100;
    displayedPercent = 100;
    renderProgress();
    setLoaderTitle('Selesai...');
    clearInterval(animateProgressTimer);
    return new Promise((resolve)=>{
      loader.classList.add('is-done');
      document.body.classList.add('loaded');
      setTimeout(()=>{
        loader.remove();
        resolve();
      }, 280);
    });
  }).catch(()=>{
    clearInterval(animateProgressTimer);
    targetPercent = 100;
    displayedPercent = 100;
    renderProgress();
    setLoaderTitle('Selesai...');
    document.body.classList.add('loaded');
    loader.classList.add('is-done');
    return new Promise((resolve)=>{
      setTimeout(()=>{
        loader.remove();
        resolve();
      }, 280);
    });
  });
}

// wire UI
document.addEventListener('DOMContentLoaded', ()=>{
  setupPageLoader().then(()=>{
    setupIntroGate();
    setupPhotoSlider();
    setupMemoryGalleryTemplate();
    setupScrollReveal();
    setupPhotoModal();
    document.getElementById('playBtn').addEventListener('click', ()=>{
      startMusic();
    });
    document.getElementById('stopBtn').addEventListener('click', ()=>{
      stopMusic();
    });
    document.getElementById('volume').addEventListener('input', (e)=>{
      const v = parseFloat(e.target.value);
      if (masterGain) masterGain.gain.value = v;
      if (audioElement && !audioSourceNode){
        audioElement.volume = v;
      }
    });
    document.getElementById('confettiBtn').addEventListener('click', ()=> runConfetti());
  });
});
