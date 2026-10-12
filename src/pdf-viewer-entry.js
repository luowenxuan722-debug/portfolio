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
// Larger chunks overfetch scattered objects in these image-heavy portfolio PDFs.
const pdfRangeChunkSize = 64 * 1024;
const pendingPages = new Set();
let activeRenders = 0;

function queuePage(record) {
  if (!record.nearby || record.rendering || record.canvas) return;
  pendingPages.add(record);
  drainPageQueue();
}

function drainPageQueue() {
  while (activeRenders < 2 && pendingPages.size) {
    const record = pendingPages.values().next().value;
    pendingPages.delete(record);
    if (!record.nearby || record.rendering || record.canvas) continue;
    const sequence = renderSequence;
    activeRenders += 1;
    renderPage(record).finally(() => {
      if (sequence !== renderSequence) return;
      activeRenders -= 1;
      drainPageQueue();
    });
  }
}

function setStatus(message = '', mode = 'loading') {
  if (!(statusNode instanceof HTMLElement)) return;
  statusNode.textContent = message;
  statusNode.dataset.mode = mode;
  statusNode.hidden = !message;
}

function releasePage(record) {
  pendingPages.delete(record);
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

async function renderPage(record, loadedPage = null) {
  if (!pdfDocument || record.rendering || record.canvas) return;
  const sequence = renderSequence;
  const version = record.version;
  record.rendering = true;
  try {
    const page = loadedPage || await pdfDocument.getPage(record.number);
    if (sequence !== renderSequence || version !== record.version) return;
    const baseViewport = page.getViewport({ scale: 1 });
    record.node.style.aspectRatio = `${baseViewport.width} / ${baseViewport.height}`;
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
    return true;
  } catch (error) {
    if (sequence !== renderSequence || version !== record.version || error?.name === 'RenderingCancelledException') return;
    releasePage(record);
    record.node.querySelector('span').textContent = `第 ${record.number} 页加载失败，可下载 PDF 查看。`;
  } finally {
    if (sequence === renderSequence) {
      record.rendering = false;
      if (version !== record.version && record.nearby) queuePage(record);
    }
  }
}

function clearDocument() {
  renderSequence += 1;
  pendingPages.clear();
  activeRenders = 0;
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
    documentTask = getDocument({
      url,
      rangeChunkSize: pdfRangeChunkSize,
      // Both settings are needed to avoid fetching the whole file in the background.
      disableAutoFetch: true,
      disableStream: true
    });
    const loadedDocument = await documentTask.promise;
    if (sequence !== renderSequence) return;
    pdfDocument = loadedDocument;
    const firstPage = await loadedDocument.getPage(1);
    if (sequence !== renderSequence) return;
    const firstViewport = firstPage.getViewport({ scale: 1 });
    const fragment = document.createDocumentFragment();

    for (let number = 1; number <= loadedDocument.numPages; number += 1) {
      const node = document.createElement('div');
      node.className = 'pdf-viewer__page';
      node.dataset.pageNumber = number;
      // Use page 1's dimensions until this page approaches the viewport.
      node.style.aspectRatio = `${firstViewport.width} / ${firstViewport.height}`;
      node.setAttribute('role', 'group');
      node.setAttribute('aria-label', `第 ${number} 页，共 ${loadedDocument.numPages} 页`);
      node.setAttribute('aria-busy', 'true');
      const placeholder = document.createElement('span');
      placeholder.textContent = `正在加载第 ${number} 页…`;
      node.append(placeholder);
      const record = { number, node, nearby: false, version: 0, canvas: null, task: null, rendering: false };
      pages.push(record);
      fragment.append(node);
    }
    canvasWrap.append(fragment);
    pages[0].nearby = true;
    const firstRendered = await renderPage(pages[0], firstPage);
    if (sequence !== renderSequence) return;
    if (firstRendered) setStatus();
    else setStatus('第一页加载失败，可滚动查看其他页面或下载 PDF。', 'error');

    // Start nearby-page work only after the first page has finished rendering.
    pageObserver = new IntersectionObserver((entries) => {
      if (sequence !== renderSequence) return;
      entries.forEach((entry) => {
        const record = pages[Number(entry.target.dataset.pageNumber) - 1];
        record.nearby = entry.isIntersecting;
        if (record.nearby) queuePage(record);
        else releasePage(record);
      });
    }, { root: canvasWrap, rootMargin: '50% 0px' });
    pages.forEach(record => pageObserver.observe(record.node));
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
      if (record.nearby) queuePage(record);
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
