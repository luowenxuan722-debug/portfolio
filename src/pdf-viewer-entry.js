import previewPages from './pdf-preview-pages.json';

let enginePromise = null;
function loadPdfEngine() {
  if (!enginePromise) enginePromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = new URL('./assets/pdf-engine.bundle.js?v=20261012-pages-1', window.location.href).href;
    script.onload = () => {
      const engine = window.PortfolioPdfEngine;
      engine.GlobalWorkerOptions.workerSrc = new URL('./assets/pdf.worker.min.mjs', window.location.href).href;
      resolve(engine);
    };
    script.onerror = () => { enginePromise = null; script.remove(); reject(new Error('PDF engine unavailable')); };
    document.head.append(script);
  });
  return enginePromise;
}

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
  record.cancelLoad?.();
  record.cancelLoad = null;
  if (record.image) {
    record.image.removeAttribute('src');
    record.image.remove();
    record.image = null;
  }
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
  if (record.preview) return renderPreviewPage(record);
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

async function renderPreviewPage(record) {
  if (record.rendering || record.canvas) return;
  const sequence = renderSequence;
  const version = record.version;
  record.rendering = true;
  const image = new Image();
  record.image = image;
  image.alt = `PDF 第 ${record.number} 页`;
  image.width = record.preview.width;
  image.height = record.preview.height;
  image.decoding = 'async';
  image.fetchPriority = record.number === 1 ? 'high' : 'low';
  try {
    const loaded = await new Promise((resolve, reject) => {
      record.cancelLoad = () => { image.onload = image.onerror = null; resolve(false); };
      image.onload = () => resolve(true);
      image.onerror = () => reject(new Error('Page image unavailable'));
      image.src = record.preview.src;
    });
    if (!loaded || sequence !== renderSequence || version !== record.version) return;
    record.canvas = image;
    record.node.append(image);
    record.node.setAttribute('aria-busy', 'false');
    return true;
  } catch {
    if (sequence !== renderSequence || version !== record.version) return;
    record.node.querySelector('span').textContent = `第 ${record.number} 页加载失败，可下载 PDF 查看。`;
  } finally {
    if (sequence === renderSequence) {
      record.cancelLoad = null;
      record.rendering = false;
      if (version !== record.version && record.nearby) queuePage(record);
    }
  }
}

async function loadIndependentPages(previews, sequence) {
  const fragment = document.createDocumentFragment();
  previews.forEach((preview, index) => {
    const number = index + 1;
    const node = document.createElement('div');
    node.className = 'pdf-viewer__page';
    node.dataset.pageNumber = number;
    node.style.aspectRatio = `${preview.width} / ${preview.height}`;
    node.setAttribute('role', 'group');
    node.setAttribute('aria-label', `第 ${number} 页，共 ${previews.length} 页`);
    node.setAttribute('aria-busy', 'true');
    const placeholder = document.createElement('span');
    placeholder.textContent = number === 1 ? '正在加载第 1 页…' : `第 ${number} 页，滚动到附近时加载`;
    node.append(placeholder);
    pages.push({ number, node, preview, nearby: false, version: 0, canvas: null, image: null, task: null, rendering: false });
    fragment.append(node);
  });
  canvasWrap.append(fragment);
  setStatus();
  pages[0].nearby = true;
  await renderPage(pages[0]);
  if (sequence !== renderSequence) return;
  pageObserver = new IntersectionObserver(entries => {
    if (sequence !== renderSequence) return;
    entries.forEach(entry => {
      const record = pages[Number(entry.target.dataset.pageNumber) - 1];
      record.nearby = entry.isIntersecting;
      if (record.nearby) queuePage(record);
      else releasePage(record);
    });
  }, { root: canvasWrap, rootMargin: '50% 0px' });
  pages.forEach(record => pageObserver.observe(record.node));
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
    const requested = new URL(url, window.location.href);
    const previewKey = Object.keys(previewPages).find(key => {
      const known = new URL(key, window.location.href);
      return known.origin === requested.origin && known.pathname === requested.pathname;
    });
    if (previewKey) {
      await loadIndependentPages(previewPages[previewKey], sequence);
      return;
    }
    const { getDocument } = await loadPdfEngine();
    if (sequence !== renderSequence) return;
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
