// Minimal WebAudio-based backsound (no external audio files)
let audioCtx = null;
let masterGain = null;
let isPlaying = false;
let scheduled = [];
let audioElement = null;
let audioSourceNode = null;

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
  let w = canvas.width = window.innerWidth;
  let h = canvas.height = window.innerHeight;
  const pieces = [];
  const colors = ['#ff6b6b','#ffd93d','#6bf0c3','#6b8bff','#d46bff'];
  for (let i=0;i<120;i++){
    pieces.push({x:Math.random()*w,y:Math.random()*-h, r:Math.random()*6+4, c:colors[Math.floor(Math.random()*colors.length)], vx:(Math.random()-0.5)*1.6, vy:Math.random()*2+1, rot:Math.random()*360});
  }
  let raf;
  function draw(){
    ctx.clearRect(0,0,w,h);
    for (const p of pieces){
      p.x += p.vx; p.y += p.vy; p.rot += 6;
      ctx.save();
      ctx.translate(p.x,p.y);
      ctx.rotate(p.rot*Math.PI/180);
      ctx.fillStyle = p.c;
      ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r*1.6);
      ctx.restore();
      if (p.y > h + 20) { p.y = Math.random()*-h; p.x = Math.random()*w; }
    }
    raf = requestAnimationFrame(draw);
  }
  draw();
  setTimeout(()=>{ cancelAnimationFrame(raf); ctx.clearRect(0,0,w,h); }, 6000);
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

  const imageElements = Array.from(document.querySelectorAll('.photo-frame .photo, .end-photo'));
  const imageUrls = Array.from(new Set(imageElements.map((img)=> img.getAttribute('src')).filter(Boolean)));
  const total = imageUrls.length || 1;
  let completed = 0;
  let targetPercent = 0;
  let displayedPercent = 0;
  const startedAt = performance.now();
  const minimumDuration = 1000;

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
    targetPercent = Math.min(100, Math.round((completed / total) * 100));
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

  targetPercent = 6;
  renderProgress();

  const allReady = imageUrls.length ? Promise.all(imageUrls.map(loadImage)) : Promise.resolve().then(()=>{
    completed = 1;
    updateTargetProgress();
  });

  return allReady.then(()=>{
    completed = total;
    targetPercent = 100;
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
    window.addEventListener('resize', ()=>{
      const c=document.getElementById('confettiCanvas'); c.width=window.innerWidth; c.height=window.innerHeight;
    });
  });
});
