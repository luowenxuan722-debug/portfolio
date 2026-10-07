import { gsap } from 'gsap';

// Adapted for this static site from React Bits PillNav's circle-fill and label-roll
// interaction: https://reactbits.dev/components/pill-nav
const nav = document.querySelector('.desktop-nav');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
const links = [...nav.querySelectorAll('a')];

links.forEach((link) => {
  const text = link.textContent;
  const circle = document.createElement('span');
  circle.className = 'pill-hover-circle';
  circle.setAttribute('aria-hidden', 'true');
  const stack = document.createElement('span');
  stack.className = 'pill-label-stack';
  const label = document.createElement('span');
  label.className = 'pill-label';
  label.textContent = text;
  const hoverLabel = document.createElement('span');
  hoverLabel.className = 'pill-label-hover';
  hoverLabel.textContent = text;
  hoverLabel.setAttribute('aria-hidden', 'true');
  stack.append(label, hoverLabel);
  link.replaceChildren(circle, stack);

  function animate(entered) {
    const width = link.clientWidth;
    const height = link.clientHeight;
    const diameter = Math.ceil((width * width / 4 + height * height) / height) + 2;
    circle.style.width = circle.style.height = `${diameter}px`;
    circle.style.bottom = `${-(diameter - height) / 2}px`;
    const duration = reduceMotion.matches ? 0 : entered ? .35 : .24;
    gsap.to(circle, { scale: entered ? 1.2 : 0, duration, ease: 'power3.out', overwrite: true });
    gsap.to(label, { y: entered ? -height : 0, opacity: entered ? 0 : 1, duration, ease: 'power3.out', overwrite: true });
    gsap.to(hoverLabel, { y: entered ? 0 : height, opacity: entered ? 1 : 0, duration, ease: 'power3.out', overwrite: true });
  }
  gsap.set(hoverLabel, { y: 42 });
  link.addEventListener('pointerenter', () => animate(true));
  link.addEventListener('pointerleave', () => animate(link === document.activeElement));
  link.addEventListener('focus', () => animate(true));
  link.addEventListener('blur', () => animate(link.matches(':hover')));
});

// Transform-only entry animation leaves navigation dimensions stable.
gsap.matchMedia().add('(prefers-reduced-motion: no-preference)', () => {
  gsap.from(nav, { scaleX: .65, opacity: 0, duration: .6, ease: 'power3.out' });
  gsap.from(links, { y: 12, opacity: 0, duration: .45, stagger: .055, delay: .12, ease: 'power3.out' });
});

const allLinks = [...document.querySelectorAll('.desktop-nav a, .mobile-nav a[href^="#"]')];
const sections = links.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
function setCurrent(id) {
  allLinks.forEach((link) => {
    if (link.getAttribute('href') === `#${id}`) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
}
allLinks.forEach((link) => link.addEventListener('click', () => setCurrent(link.hash.slice(1))));
const sectionObserver = new IntersectionObserver((entries) => {
  const visible = entries.filter((entry) => entry.isIntersecting);
  if (visible.length) setCurrent(visible[visible.length - 1].target.id);
}, { rootMargin: '-15% 0px -65% 0px', threshold: 0 });
sections.forEach((section) => sectionObserver.observe(section));
setCurrent(location.hash.slice(1) || 'top');

const menuButton = document.querySelector('.menu-button');
function closeMobileMenu() {
  if (menuButton?.getAttribute('aria-expanded') === 'true') menuButton.click();
}
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuButton?.getAttribute('aria-expanded') === 'true') {
    closeMobileMenu();
    menuButton.focus();
  }
});
document.addEventListener('pointerdown', (event) => {
  if (!event.target.closest('.mobile-nav, .menu-button')) closeMobileMenu();
});
window.matchMedia('(min-width: 1041px)').addEventListener('change', (event) => {
  if (event.matches) closeMobileMenu();
});
