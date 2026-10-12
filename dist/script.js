const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const menuButton = document.querySelector('.menu-button');
const mobileNav = document.querySelector('.mobile-nav');

function setMenu(open) {
  menuButton?.setAttribute('aria-expanded', String(open));
  menuButton?.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
  mobileNav?.setAttribute('aria-hidden', String(!open));
  mobileNav?.classList.toggle('is-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
}

menuButton?.addEventListener('click', () => {
  setMenu(menuButton.getAttribute('aria-expanded') !== 'true');
});

mobileNav?.addEventListener('click', (event) => {
  if (event.target instanceof HTMLAnchorElement) setMenu(false);
});

const header = document.querySelector('[data-header]');
const hero = document.querySelector('.hero');
if (header && hero && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(([entry]) => {
    header.classList.toggle('is-scrolled', entry.intersectionRatio < 0.86);
  }, { threshold: [0.86] });
  observer.observe(hero);
}

const typewriter = document.querySelector('#typewriter');
const cursor = document.querySelector('.type-cursor');
if (typewriter) {
  const fullText = typewriter.dataset.text || '';
  if (reduceMotion.matches) {
    typewriter.textContent = fullText;
    cursor?.classList.add('is-done');
  } else {
    let index = 0;
    window.setTimeout(() => {
      const timer = window.setInterval(() => {
        index += 1;
        typewriter.textContent = fullText.slice(0, index);
        if (index >= fullText.length) {
          window.clearInterval(timer);
          cursor?.classList.add('is-done');
        }
      }, 38);
    }, 600);
  }
}

const heroActions = document.querySelector('[data-actions]');
if (reduceMotion.matches) {
  heroActions?.classList.add('is-visible');
} else {
  window.setTimeout(() => heroActions?.classList.add('is-visible'), 400);
}

const copyButton = document.querySelector('[data-copy-email]');
const emailLabel = document.querySelector('[data-email-label]');
copyButton?.addEventListener('click', async () => {
  try {
    await navigator.clipboard.writeText('969230419@qq.com');
    if (emailLabel) emailLabel.textContent = 'Email copied';
    window.setTimeout(() => {
      if (emailLabel) emailLabel.innerHTML = 'Email me: <u>969230419@qq.com</u>';
    }, 1600);
  } catch {
    window.location.href = 'mailto:969230419@qq.com';
  }
});

const characterVideo = document.querySelector('#character-video');

if (characterVideo instanceof HTMLVideoElement) {
  let pointerFrame = 0;
  let pointerX = window.innerWidth / 2;
  let pointerY = window.innerHeight / 2;
  let currentTime = 0;
  let targetTime = 0;
  let lastSeekFrame = 0;
  let lastSeekAt = 0;
  const frameRate = 24;
  let isInitialized = false;

  function initializeCharacterVideo() {
    if (isInitialized || characterVideo.readyState < HTMLMediaElement.HAVE_METADATA || !Number.isFinite(characterVideo.duration)) return;
    isInitialized = true;
    currentTime = Math.min(characterVideo.currentTime || 0, characterVideo.duration);
    targetTime = timeForPointer(pointerX, pointerY);
    characterVideo.classList.add('is-ready');
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(updateLookDirection);
  }

  function timeForPointer(x, y) {
    const dx = (x - window.innerWidth / 2) / Math.max(window.innerWidth / 2, 1);
    const dy = (y - window.innerHeight / 2) / Math.max(window.innerHeight / 2, 1);
    if (Math.hypot(dx, dy) < .1) return 0;

    const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
    const duration = characterVideo.duration || 10;
    const stops = [
      [0, 3.5], [Math.PI / 4, 2.5], [Math.PI / 2, 1], [Math.PI * .75, -.5],
      [Math.PI, -2], [Math.PI * 1.25, -3], [Math.PI * 1.5, -4],
      [Math.PI * 1.75, -5], [Math.PI * 2, -6.5],
    ];
    const stopIndex = stops.findIndex(([stopAngle]) => angle <= stopAngle);
    const [startAngle, startTime] = stops[Math.max(0, stopIndex - 1)];
    const [endAngle, endTime] = stops[Math.max(1, stopIndex)];
    const progress = (angle - startAngle) / (endAngle - startAngle);
    const videoSeconds = startTime + (endTime - startTime) * progress;
    return ((videoSeconds / 10 * duration) % duration + duration) % duration;
  }

  function updateLookDirection() {
    pointerFrame = 0;
    if (!isInitialized || characterVideo.readyState < HTMLMediaElement.HAVE_METADATA || !characterVideo.duration) return;

    const duration = characterVideo.duration;
    const delta = ((targetTime - currentTime + duration * 1.5) % duration) - duration / 2;
    currentTime = Math.abs(delta) < 1 / frameRate ? targetTime : (currentTime + delta * .22 + duration) % duration;

    const nextFrame = Math.round(currentTime * frameRate) % Math.round(duration * frameRate);
    const now = performance.now();
    if (nextFrame !== lastSeekFrame && !characterVideo.seeking && now - lastSeekAt >= 1000 / frameRate) {
      lastSeekFrame = nextFrame;
      characterVideo.currentTime = nextFrame / frameRate;
      lastSeekAt = now;
    }

    if (Math.abs(delta) >= 1 / frameRate || characterVideo.seeking) {
      pointerFrame = window.requestAnimationFrame(updateLookDirection);
    }
  }

  function handlePointerMove(event) {
    pointerX = event.clientX;
    pointerY = event.clientY;
    targetTime = timeForPointer(pointerX, pointerY);
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(updateLookDirection);
  }

  window.addEventListener('pointermove', handlePointerMove, { passive: true });

  document.documentElement.addEventListener('pointerleave', () => {
    pointerX = window.innerWidth / 2;
    pointerY = window.innerHeight / 2;
    targetTime = 0;
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(updateLookDirection);
  });

  characterVideo.addEventListener('loadedmetadata', initializeCharacterVideo, { once: true });
  characterVideo.addEventListener('loadeddata', initializeCharacterVideo, { once: true });
  characterVideo.addEventListener('canplay', initializeCharacterVideo, { once: true });

  if (characterVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
    initializeCharacterVideo();
  } else {
    characterVideo.load();
  }
}
