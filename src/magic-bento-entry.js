import { gsap } from 'gsap';

const grid = document.querySelector('[data-magic-bento]');
const cards = grid ? [...grid.querySelectorAll('[data-magic-bento-card]')] : [];
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 769px)');
const spotlightRadius = 530;

if (grid && cards.length && !reduceMotion.matches && finePointer.matches) {
  const spotlight = document.createElement('div');
  spotlight.className = 'magic-bento-spotlight';
  spotlight.setAttribute('aria-hidden', 'true');
  grid.append(spotlight);

  const spotlightX = gsap.quickTo(spotlight, 'x', { duration: .22, ease: 'power2.out' });
  const spotlightY = gsap.quickTo(spotlight, 'y', { duration: .22, ease: 'power2.out' });
  const spotlightOpacity = gsap.quickTo(spotlight, 'opacity', { duration: .3, ease: 'power2.out' });
  let pointerFrame = 0;
  let pointerX = 0;
  let pointerY = 0;

  const renderSpotlight = () => {
    pointerFrame = 0;
    cards.forEach(card => {
      const rect = card.getBoundingClientRect();
      const nearestX = Math.max(rect.left, Math.min(pointerX, rect.right));
      const nearestY = Math.max(rect.top, Math.min(pointerY, rect.bottom));
      const distance = Math.hypot(pointerX - nearestX, pointerY - nearestY);
      const intensity = Math.max(0, 1 - distance / 280);
      card.style.setProperty('--glow-x', `${pointerX - rect.left}px`);
      card.style.setProperty('--glow-y', `${pointerY - rect.top}px`);
      card.style.setProperty('--glow-intensity', intensity.toFixed(3));
    });
  };

  grid.addEventListener('pointermove', event => {
    pointerX = event.clientX;
    pointerY = event.clientY;
    const gridRect = grid.getBoundingClientRect();
    spotlightX(event.clientX - gridRect.left - spotlightRadius);
    spotlightY(event.clientY - gridRect.top - spotlightRadius);
    if (!pointerFrame) pointerFrame = window.requestAnimationFrame(renderSpotlight);
  }, { passive: true });

  grid.addEventListener('pointerenter', () => spotlightOpacity(1));

  grid.addEventListener('pointerleave', () => {
    spotlightOpacity(0);
    cards.forEach(card => card.style.setProperty('--glow-intensity', '0'));
  });

  cards.forEach(card => {
    const moveX = gsap.quickTo(card, 'x', { duration: .42, ease: 'power3.out' });
    const moveY = gsap.quickTo(card, 'y', { duration: .42, ease: 'power3.out' });

    card.addEventListener('pointermove', event => {
      const rect = card.getBoundingClientRect();
      moveX(((event.clientX - rect.left) / rect.width - .5) * 9);
      moveY(((event.clientY - rect.top) / rect.height - .5) * 9);
    }, { passive: true });

    card.addEventListener('pointerenter', () => {
      if (card.querySelector('.magic-bento-particle')) return;
      const rect = card.getBoundingClientRect();
      Array.from({ length: 7 }).forEach((_, index) => {
        const particle = document.createElement('span');
        particle.className = 'magic-bento-particle';
        particle.setAttribute('aria-hidden', 'true');
        particle.style.left = `${12 + Math.random() * Math.max(rect.width - 24, 1)}px`;
        particle.style.top = `${12 + Math.random() * Math.max(rect.height - 24, 1)}px`;
        card.append(particle);
        gsap.fromTo(particle,
          { scale: 0, opacity: 0, x: 0, y: 0 },
          {
            scale: 1.15,
            opacity: .72,
            x: (Math.random() - .5) * 18,
            y: -10 - Math.random() * 18,
            duration: .7,
            delay: index * .035,
            repeat: 1,
            yoyo: true,
            ease: 'power2.out',
            onComplete: () => particle.remove()
          }
        );
      });
    });

    card.addEventListener('pointerleave', () => {
      moveX(0);
      moveY(0);
    });
  });
}
