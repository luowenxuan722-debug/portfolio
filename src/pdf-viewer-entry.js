import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs';

GlobalWorkerOptions.workerSrc = new URL('./assets/pdf.worker.min.mjs', window.location.href).href;

const viewer = document.querySelector('[data-pdf-viewer]');
const canvasWrap = document.querySelector('[data-pdf-canvas-wrap]');
const titleNode = viewer?.querySelector('[data-pdf-title]');
const downloadLink = document.querySelector('[data-pdf-download]');
const statusNode = document.querySelector('[data-pdf-status]');
const closeButton = document.querySelector('[data-pdf-close]');

let documentTask = null;
let pdfDocument = null;
let pageObserver = null;
let pages = [];
let currentUrl = '';
let currentDownloadUrl = '';
let currentTitle = '';
let lastTrigger = null;
let renderSequence = 0;

function setStatus(message = '', mode = 'loading') {
  if (!(statusNode instanceof HTMLElement)) return;
  statusNode.textContent = message;
  statusNode.dataset.mode = mode;
  statusNode.hidden = !message;
}

function releasePage(record) {
  record.version += 1;
  record.task?.cancel();
  record.task = null;
  if (record.canvas) {
    record.canvas.remove();
    record.canvas.width = record.canvas.height = 0;
    record.canvas = null;
  }
  record.rendering = false;
  record.node.setAttribute('aria-busy', 'true');
}

async function renderPage(record) {
  if (!pdfDocument || record.rendering || record.canvas) return;
  const sequence = renderSequence;
  const version = record.version;
  record.rendering = true;
  try {
    const page = await pdfDocument.getPage(record.number);
    if (sequence !== renderSequence || version !== record.version) return;
    const baseViewport = page.getViewport({ scale: 1 });
    const cssScale = record.node.clientWidth / baseViewport.width;
    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    const renderViewport = page.getViewport({ scale: cssScale * pixelRatio });
    const canvas = document.createElement('canvas');
    canvas.setAttribute('aria-label', `PDF 第 ${record.number} 页`);
    canvas.width = Math.ceil(renderViewport.width);
    canvas.height = Math.ceil(renderViewport.height);
    record.canvas = canvas;
    const context = canvas.getContext('2d', { alpha: false });
    record.task = page.render({ canvasContext: context, viewport: renderViewport });
    await record.task.promise;
    if (sequence !== renderSequence || version !== record.version) return;
    record.node.append(canvas);
    record.node.setAttribute('aria-busy', 'false');
  } catch (error) {
    if (sequence !== renderSequence || version !== record.version || error?.name === 'RenderingCancelledException') return;
    releasePage(record);
    record.node.querySelector('span').textContent = `第 ${record.number} 页加载失败，可下载 PDF 查看。`;
  } finally {
    if (sequence === renderSequence && version === record.version) record.rendering = false;
  }
}

function clearDocument() {
  renderSequence += 1;
  pageObserver?.disconnect();
  pages.forEach(releasePage);
  pages = [];
  canvasWrap?.replaceChildren();
  documentTask?.destroy()?.catch(() => {});
  documentTask = null;
  pdfDocument = null;
}

async function loadPdf(url) {
  clearDocument();
  const sequence = renderSequence;
  canvasWrap.scrollTop = 0;
  setStatus('正在加载 PDF…');

  try {
    documentTask = getDocument({ url });
    const loadedDocument = await documentTask.promise;
    if (sequence !== renderSequence) return;
    pdfDocument = loadedDocument;
    pageObserver = new IntersectionObserver((entries) => {
      if (sequence !== renderSequence) return;
      entries.forEach((entry) => {
        const record = pages[Number(entry.target.dataset.pageNumber) - 1];
        record.nearby = entry.isIntersecting;
        if (record.nearby) renderPage(record);
        else releasePage(record);
      });
    }, { root: canvasWrap, rootMargin: '100% 0px' });

    for (let number = 1; number <= loadedDocument.numPages; number += 1) {
      const page = await loadedDocument.getPage(number);
      if (sequence !== renderSequence) return;
      const viewport = page.getViewport({ scale: 1 });
      const node = document.createElement('div');
      node.className = 'pdf-viewer__page';
      node.dataset.pageNumber = number;
      node.style.aspectRatio = `${viewport.width} / ${viewport.height}`;
      node.setAttribute('role', 'group');
      node.setAttribute('aria-label', `第 ${number} 页，共 ${loadedDocument.numPages} 页`);
      node.setAttribute('aria-busy', 'true');
      const placeholder = document.createElement('span');
      placeholder.textContent = `正在加载第 ${number} 页…`;
      node.append(placeholder);
      const record = { number, node, nearby: false, version: 0, canvas: null, task: null, rendering: false };
      pages.push(record);
      canvasWrap.append(node);
      pageObserver.observe(node);
      if (number === 1) setStatus();
    }
  } catch {
    if (sequence !== renderSequence) return;
    setStatus('无法读取这份 PDF。请点击“下载pdf”在本机查看。', 'error');
  }
}

function httpPreviewUrl(url, downloadUrl, title) {
  const target = new URL('http://127.0.0.1:4173/');
  target.searchParams.set('pdf', url.replace(/^\.\//, ''));
  target.searchParams.set('pdfDownload', (downloadUrl || url).replace(/^\.\//, ''));
  target.searchParams.set('pdfTitle', title);
  target.hash = 'work';
  return target.href;
}

function openPdfPreview(url, title, trigger = null, downloadUrl = url) {
  if (!url || !(viewer instanceof HTMLElement)) return;
  if (window.location.protocol === 'file:') {
    window.location.href = httpPreviewUrl(url, downloadUrl, title || '作品集');
    return;
  }

  currentUrl = url;
  currentDownloadUrl = downloadUrl || url;
  currentTitle = title || '作品集';
  lastTrigger = trigger instanceof HTMLElement ? trigger : document.activeElement;
  if (titleNode) titleNode.textContent = currentTitle;
  if (downloadLink instanceof HTMLAnchorElement) {
    downloadLink.href = currentDownloadUrl;
    const downloadTarget = new URL(currentDownloadUrl, window.location.href);
    const externalDownload = downloadTarget.origin !== window.location.origin;
    if (externalDownload) {
      downloadLink.removeAttribute('download');
      downloadLink.target = '_blank';
      downloadLink.rel = 'noopener noreferrer';
      const code = downloadTarget.searchParams.get('pwd');
      downloadLink.textContent = code ? `下载pdf（提取码：${code}）` : '下载pdf';
    } else {
      downloadLink.download = `${currentTitle}.pdf`;
      downloadLink.removeAttribute('target');
      downloadLink.removeAttribute('rel');
      downloadLink.textContent = '下载pdf';
    }
  }
  viewer.classList.add('is-open');
  viewer.setAttribute('aria-hidden', 'false');
  document.body.classList.add('pdf-preview-open');
  closeButton?.focus();
  loadPdf(currentUrl);
}

function closePdfPreview() {
  if (!(viewer instanceof HTMLElement)) return;
  clearDocument();
  viewer.classList.remove('is-open');
  viewer.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('pdf-preview-open');
  setStatus();
  lastTrigger?.focus?.();
}

document.querySelectorAll('[data-pdf-preview]').forEach((trigger) => {
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    openPdfPreview(
      trigger.dataset.pdfPreview || '',
      trigger.dataset.pdfTitle || '作品集',
      trigger,
      trigger.dataset.pdfDownloadUrl || trigger.dataset.pdfPreview || ''
    );
  });
});

window.addEventListener('portfolio:open-pdf', (event) => {
  const detail = event.detail || {};
  openPdfPreview(detail.url || '', detail.title || '作品集', null, detail.downloadUrl || detail.url || '');
});

closeButton?.addEventListener('click', closePdfPreview);
viewer?.addEventListener('mousedown', (event) => {
  if (event.target === viewer) closePdfPreview();
});
document.addEventListener('keydown', (event) => {
  if (!viewer?.classList.contains('is-open')) return;
  if (event.key === 'Escape') closePdfPreview();
});

let resizeTimer = 0;
const resizeObserver = new ResizeObserver(() => {
  window.clearTimeout(resizeTimer);
  resizeTimer = window.setTimeout(() => {
    if (!viewer?.classList.contains('is-open') || !pdfDocument) return;
    pages.forEach((record) => {
      releasePage(record);
      if (record.nearby) renderPage(record);
    });
  }, 120);
});
if (canvasWrap instanceof HTMLElement) resizeObserver.observe(canvasWrap);

const search = new URLSearchParams(window.location.search);
const requestedPdf = search.get('pdf');
if (requestedPdf) {
  const requestedTitle = search.get('pdfTitle') || '作品集';
  const requestedDownload = search.get('pdfDownload') || requestedPdf;
  window.setTimeout(() => openPdfPreview(`./${requestedPdf}`, requestedTitle, null, `./${requestedDownload}`), 0);
}
