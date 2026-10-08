import { buildDemoProject } from './workflow.js';
const $ = id => document.getElementById(id);
const form = $('storyboard-form');
// Static-hosting build: demo generation runs locally in the browser.
// Claude-assisted features require the Node.js server version.
let project = null;
let liveAvailable = false;
let currentFile = null;
let previewObjectURL = null;

function el(tag, className = '', content = '') {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== '') node.textContent = content;
  return node;
}
function notify(message, success = false) {
  const out = $('form-feedback');
  out.textContent = message;
  out.classList.toggle('success', success);
}
function getInputs() {
  return {
    brief: $('brief').value.trim(), duration: Number($('duration').value),
    shotCount: Number($('shotCount').value), style: $('style').value,
    platform: $('platform').value, characterName: $('characterName').value.trim(),
    characterDescription: $('characterDescription').value.trim(),
    mode: form.elements.mode.value
  };
}
function buttonState() {
  const busy = $('generate-btn').disabled;
  $('generate-btn').disabled = busy;
  $('generate-label').textContent = busy ? 'Generating…' : 'Generate storyboard';
}
async function getJSON(url, options) {
  const response = await fetch(url, options);
  let data;
  try { data = await response.json(); } catch { throw new Error('Unexpected response from server.'); }
  if (!response.ok) throw new Error(data?.error || `Request failed (${response.status}).`);
  return data;
}
function textRow(container, label, value) {
  container.append(el('div', 'shot-label', label));
  container.append(el('p', '', value));
}
function renderProject() {
  if (!project?.shots?.length) return;
  $('empty-state').classList.add('hidden');
  $('shot-results').classList.remove('hidden');
  $('project-heading').textContent = project.title || 'Untitled production';
  $('project-summary').textContent = `${project.duration} seconds · ${project.shots.length} shots · ${project.style} · ${project.mode === 'claude' ? 'Generated with Claude API' : 'Deterministic template demo (not AI generated)'}`;
  for (const id of ['save-btn', 'markdown-btn', 'json-btn']) $(id).disabled = false;
  const reviewShotSelect = $('review-shot');
  reviewShotSelect.replaceChildren();
  for (const shot of project.shots) {
    const option = document.createElement('option');
    option.value = String(shot.index - 1);
    option.textContent = `Shot ${shot.index}: ${shot.title}`;
    reviewShotSelect.append(option);
  }
  const container = $('shot-results');
  container.replaceChildren();
  const toolbar = el('div', 'shot-toolbar');
  toolbar.append(el('span', '', 'EDITABLE PRODUCTION SEQUENCE'));
  toolbar.append(el('span', 'shot-count', `${project.shots.length} SHOTS / ${project.duration}s`));
  container.append(toolbar);
  const grid = el('div', 'shot-grid');
  for (const shot of project.shots) {
    const card = el('article', 'shot-card');
    const head = el('div', 'shot-card-head');
    head.append(el('div', 'shot-index', String(shot.index).padStart(2, '0')));
    const heading = el('div');
    heading.append(el('strong', '', shot.title));
    heading.append(el('small', '', `${String(shot.startSec).padStart(2, '0')}s — ${String(shot.endSec).padStart(2, '0')}s · ${shot.durationSec}s`));
    head.append(heading);
    card.append(head);
    const body = el('div', 'shot-card-body');
    textRow(body, 'Camera', shot.camera);
    textRow(body, 'Scene action', shot.action);
    textRow(body, 'Lighting', shot.lighting);
    textRow(body, 'Identity / continuity', shot.continuity);
    body.append(el('div', 'shot-label', 'Editable generation prompt'));
    const textarea = el('textarea');
    textarea.setAttribute('aria-label', `Generation prompt for shot ${shot.index}`);
    textarea.value = shot.prompt;
    textarea.addEventListener('input', () => {
      shot.prompt = textarea.value;
      $('save-indicator').textContent = 'Unsaved edits · click Save locally.';
    });
    body.append(textarea);
    const foot = el('div', 'shot-card-footer');
    foot.append(el('span', `mode-pill ${project.mode === 'claude' ? 'claude' : ''}`, project.mode === 'claude' ? 'CLAUDE API' : 'FREE DEMO'));
    const copy = el('button', '', 'Copy prompt ↗');
    copy.type = 'button';
    copy.addEventListener('click', async () => {
      try { await navigator.clipboard.writeText(shot.prompt); copy.textContent = 'Copied ✓'; }
      catch { textarea.select(); document.execCommand('copy'); copy.textContent = 'Copied ✓'; }
      setTimeout(() => { copy.textContent = 'Copy prompt ↗'; }, 1600);
    });
    foot.append(copy);
    body.append(foot);
    card.append(body);
    grid.append(card);
  }
  container.append(grid);
}
function download(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; document.body.append(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
function markdown() {
  if (!project) return '';
  const lines = [`# ${project.title}`, '', `${project.duration}s · ${project.style} · ${project.platform}`, '', '## Creative brief', project.brief, '', '## Character bible', `${project.characterName || 'Unspecified'} — ${project.characterDescription || 'Unspecified'}`, '', '## Shot list'];
  project.shots.forEach(s => lines.push('', `### ${String(s.index).padStart(2,'0')}. ${s.title} (${s.startSec}–${s.endSec}s)`, `- Camera: ${s.camera}`, `- Action: ${s.action}`, `- Lighting: ${s.lighting}`, `- Continuity: ${s.continuity}`, '', '**Prompt:**', '', s.prompt));
  lines.push('', `> Produced in Velneris ${project.mode === 'claude' ? 'Claude API mode' : 'non-AI demonstration mode'}.`);
  return lines.join('\n');
}
form.addEventListener('submit', async event => {
  event.preventDefault();
  const input = getInputs();
  const button = $('generate-btn');
  button.disabled = true; buttonState(); notify('');
  try {
    if (input.mode === 'claude') {
      throw new Error('Claude-assisted generation needs the server version of Velneris Studio. This static demo runs in free demo mode only.');
    }
    const data = buildDemoProject(input);
    project = data;
    renderProject();
    $('save-indicator').textContent = 'Not saved yet · use Save locally or export.';
    notify('Working storyboard created in free non-AI demo mode.', true);
  } catch (err) { notify(err.message); }
  finally { button.disabled = false; buttonState(); }
});
$('save-btn').addEventListener('click', () => {
  if (!project) return;
  try { localStorage.setItem('velneris-studio-project-v1', JSON.stringify(project)); $('save-indicator').textContent = 'Saved in this browser.'; }
  catch { $('save-indicator').textContent = 'Could not save to this browser. Please export your project.'; }
});
$('json-btn').addEventListener('click', () => { if (project) download(JSON.stringify(project,null,2), 'velneris-project.json', 'application/json'); });
$('markdown-btn').addEventListener('click', () => { if (project) download(markdown(), 'velneris-storyboard.md', 'text/markdown'); });

for (const radio of form.querySelectorAll('input[name="mode"]')) radio.addEventListener('change', () => {
  const isClaude = form.elements.mode.value === 'claude';
  $('access-wrap').classList.toggle('hidden', !isClaude);
  $('label-demo').classList.toggle('selected', !isClaude);
  $('label-claude').classList.toggle('selected', isClaude);
});
for (const tab of document.querySelectorAll('[data-tab]')) tab.addEventListener('click', () => {
  for (const b of document.querySelectorAll('[data-tab]')) {
    const on = b === tab;
    b.classList.toggle('active', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  }
  $('storyboard-tab').classList.toggle('hidden', tab.dataset.tab !== 'storyboard');
  $('review-tab').classList.toggle('hidden', tab.dataset.tab !== 'review');
});
$('frame-upload').addEventListener('change', e => {
  const file = e.target.files?.[0];
  if (!file) return;
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2_500_000) {
    $('review-result').textContent = 'Choose a PNG, JPEG or WebP image smaller than 2.5 MB.';
    return;
  }
  currentFile = file;
  if (previewObjectURL) URL.revokeObjectURL(previewObjectURL);
  previewObjectURL = URL.createObjectURL(file);
  $('frame-preview').src = previewObjectURL;
  $('frame-preview').classList.remove('hidden');
  $('review-result').textContent = 'Frame ready. Image analysis only happens when you click Analyze with Claude.';
});
$('review-btn').addEventListener('click', async () => {
  if (!liveAvailable) { $('review-result').textContent = 'AI frame review needs the server version of Velneris Studio. The manual checklist on this page works fully offline.'; return; }
  if (!currentFile) { $('review-result').textContent = 'Please choose an image first.'; return; }
  if (!project) { $('review-result').textContent = 'Generate or load a storyboard before analyzing a frame.'; return; }
  const code = $('access-code').value;
  if (!code) { $('review-result').textContent = 'Enter the private studio access code in the left panel first.'; return; }
  const reader = new FileReader();
  const imageDataUrl = await new Promise((resolve, reject) => {
    reader.onerror = () => reject(new Error('Failed to read image.'));
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(currentFile);
  });
  const button = $('review-btn');
  button.disabled = true;
  $('review-result').textContent = 'Analyzing frame with Claude…';
  try {
    const result = await getJSON('/api/review', {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-studio-access-code': code },
      body: JSON.stringify({ imageDataUrl, brief: project.brief, characterDescription: project.characterDescription, shotPrompt: project.shots[Number($('review-shot').value)]?.prompt || project.shots[0].prompt })
    });
    const target = $('review-result'); target.replaceChildren();
    target.append(el('h5', '', `Assessment · ${result.assessment || 'Reviewed'}`));
    target.append(el('p', '', result.summary || 'No summary returned.'));
    for (const [title, list] of [['Observable findings', result.findings], ['Suggestions', result.recommendations]]) {
      target.append(el('h5', '', title));
      const ul = el('ul');
      for (const s of (Array.isArray(list) ? list : []).slice(0, 10)) ul.append(el('li', '', String(s)));
      target.append(ul);
    }
  } catch (err) { $('review-result').textContent = err.message; }
  finally { button.disabled = false; }
});

(async () => {
  // Static hosting: demo mode only. Claude features require the Node.js server version.
  liveAvailable = false;
  $('claude-availability').textContent = 'Static demo · needs server version';
  const claudeInput = $('label-claude').querySelector('input');
  if (claudeInput) claudeInput.disabled = true;
  try {
    const stored = localStorage.getItem('velneris-studio-project-v1');
    if (stored) {
      const loaded = JSON.parse(stored);
      if (loaded?.shots?.length) {
        project = loaded; renderProject();
        $('save-indicator').textContent = 'Restored from your browser storage.';
      }
    }
  } catch { /* Local storage is optional. */ }
})();
