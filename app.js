// Minimal WebAudio-based backsound (no external audio files)
let audioCtx = null;
let masterGain = null;
let isPlaying = false;
let scheduled = [];
let audioElement = null;
let audioSourceNode = null;
let confettiSession = null;

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
  const ctx = canvas.getContext('2d');
  if (!canvas || !ctx) return;

  if (confettiSession){
    cancelAnimationFrame(confettiSession.rafId);
    clearTimeout(confettiSession.stopId);
    window.removeEventListener('resize', confettiSession.onResize);
    if (window.visualViewport){
      window.visualViewport.removeEventListener('resize', confettiSession.onResize);
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  }

  const colors = ['#ff6b6b', '#ffd93d', '#6bf0c3', '#6b8bff', '#d46bff'];
  const pieces = [];
  const pieceCount = 180;
  const edgePadding = 44;
  let w = 0;
  let h = 0;

  const randomBetween = (min, max)=> min + Math.random() * (max - min);

  const createPiece = (fromTop = true)=>{
    const width = randomBetween(5, 10);
    const height = randomBetween(10, 18);
    return {
      x: randomBetween(-edgePadding, w + edgePadding),
      y: fromTop ? randomBetween(-h - edgePadding, -edgePadding) : randomBetween(-edgePadding, h + edgePadding),
      w: width,
      h: height,
      color: colors[Math.floor(Math.random() * colors.length)],
      vx: randomBetween(-1.2, 1.2),
      vy: randomBetween(1.2, 3.2),
      rotation: randomBetween(0, Math.PI * 2),
      spin: randomBetween(-0.18, 0.18),
      waveOffset: randomBetween(0, Math.PI * 2),
    };
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

  resizeCanvas();

  for (let i = 0; i < pieceCount; i += 1){
    pieces.push(createPiece(true));
  }

  let rafId = 0;
  let previousTime = performance.now();

  const draw = (now)=>{
    const delta = Math.min(34, now - previousTime) / 16.666;
    previousTime = now;
    ctx.clearRect(0, 0, w, h);

    for (const piece of pieces){
      const sway = Math.sin(now * 0.003 + piece.waveOffset) * 0.35;
      piece.x += (piece.vx + sway) * delta;
      piece.y += piece.vy * delta;
      piece.rotation += piece.spin * delta;

      if (piece.x < -edgePadding) piece.x = w + edgePadding;
      if (piece.x > w + edgePadding) piece.x = -edgePadding;
      if (piece.y > h + edgePadding){
        Object.assign(piece, createPiece(true));
      }

      const flip = 0.45 + Math.abs(Math.cos(now * 0.01 + piece.waveOffset)) * 0.9;
      ctx.save();
      ctx.translate(piece.x, piece.y);
      ctx.rotate(piece.rotation);
      ctx.scale(1, flip);
      ctx.fillStyle = piece.color;
      ctx.fillRect(-piece.w / 2, -piece.h / 2, piece.w, piece.h);
      ctx.restore();
    }

    rafId = requestAnimationFrame(draw);
  };

  const onResize = ()=>{
    resizeCanvas();
  };

  window.addEventListener('resize', onResize, { passive: true });
  if (window.visualViewport){
    window.visualViewport.addEventListener('resize', onResize, { passive: true });
  }

  rafId = requestAnimationFrame(draw);
  const stopId = setTimeout(()=>{
    cancelAnimationFrame(rafId);
    window.removeEventListener('resize', onResize);
    if (window.visualViewport){
      window.visualViewport.removeEventListener('resize', onResize);
    }
    ctx.clearRect(0, 0, w, h);
    confettiSession = null;
  }, 6500);

  confettiSession = { rafId, stopId, onResize };
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
    photo.src = img.getAttribute('src') || '';
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
    const photoElement = activeSlideImage || memoryImage;
    if (photoElement instanceof HTMLImageElement){
      openModal(photoElement.currentSrc || photoElement.src, photoElement.alt);
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
  if (!loader || !loaderBar || !loaderPercent){
    document.body.classList.add('loaded');
    return Promise.resolve();
  }

  const loaderTitle = loader.querySelector('.loader-title');
  const setLoaderTitle = (text)=>{
    if (loaderTitle) loaderTitle.textContent = text;
  };

  const imageElements = Array.from(document.querySelectorAll('.photo-frame .photo, .end-photo'));
  const imageUrls = Array.from(new Set(imageElements.map((img)=> img.getAttribute('src')).filter(Boolean)));
  const audioEl = document.getElementById('bgAudio');
  const audioUrl = audioEl && audioEl.getAttribute('src');

  const total = imageUrls.length || 1;
  let completed = 0;
  let targetPercent = 0;
  let displayedPercent = 0;
  const startedAt = performance.now();
  const minimumDuration = 1200;

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

  const updateTargetProgress = ()=>{
    const imageProgress = Math.round((completed / total) * 80);
    targetPercent = Math.min(100, 20 + imageProgress);
  };

  const loadAudioFirst = ()=>{
    if (!audioUrl){
      targetPercent = 20;
      return Promise.resolve();
    }

    setLoaderTitle('Menyiapkan audio...');
    return fetch(audioUrl, { cache: 'force-cache' })
      .then((res)=>{
        if (!res.ok) throw new Error(`audio fetch failed: ${res.status}`);
        return res.blob();
      })
      .then(()=>{
        targetPercent = 20;
      })
      .catch(()=>{
        targetPercent = 20;
      });
  };

  const loadImage = (url)=> new Promise((resolve)=>{
    let done = false;
    const finish = ()=>{
      if (done) return;
      done = true;
      completed += 1;
      updateTargetProgress();
      resolve();
    };

    const image = new Image();
    image.onload = finish;
    image.onerror = finish;
    image.src = url;
    if (image.complete) finish();
    setTimeout(finish, 5000);
  });

  targetPercent = 3;
  renderProgress();

  const loadImages = ()=>{
    setLoaderTitle('Mengunduh semua foto...');
    if (!imageUrls.length){
      completed = 1;
      updateTargetProgress();
      return Promise.resolve();
    }
    return Promise.all(imageUrls.map(loadImage));
  };

  return loadAudioFirst().then(()=> loadImages()).then(()=>{
    completed = total;
    targetPercent = 100;
    setLoaderTitle('Selesai...');
    const elapsed = performance.now() - startedAt;
    const remaining = Math.max(0, minimumDuration - elapsed);
    return new Promise((resolve)=>{
      const finishLoader = ()=>{
        if (displayedPercent < 100){
          setTimeout(finishLoader, 25);
          return;
        }
        clearInterval(animateProgressTimer);
        loader.classList.add('is-done');
        document.body.classList.add('loaded');
        setTimeout(()=>{
          loader.remove();
          resolve();
        }, 460);
      };

      setTimeout(finishLoader, remaining);
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
