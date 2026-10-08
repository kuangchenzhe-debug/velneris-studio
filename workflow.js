export const STYLES = ['Cinematic realism', 'Documentary', 'Stylized editorial', 'Soft lifestyle', 'Suspense / thriller'];
export const PLATFORMS = ['TikTok / Reels', 'YouTube Shorts', 'Short drama', 'Brand film'];
const angles = [
  ['Establishing wide shot', 'Introduce the space and establish context', 'Slow push-in'],
  ['Medium character shot', 'Follow the main character and reveal intent', 'Subtle handheld drift'],
  ['Close-up detail shot', 'Highlight a tactile or emotional detail', 'Gentle rack focus'],
  ['Over-the-shoulder shot', 'Build perspective and scene continuity', 'Smooth lateral tracking'],
  ['Low-angle moving shot', 'Make the scene feel cinematic and consequential', 'Slow dolly forward'],
  ['Reaction close-up', 'Capture an authentic emotional beat', 'Locked-off natural camera'],
  ['Environmental cutaway', 'Give the edit breathing room and visual texture', 'Controlled slow pan'],
  ['Closing hero shot', 'Deliver a memorable final frame', 'Deliberate pullback']
];

function clampText(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : '';
}

export function validateBrief(input) {
  if (!input || typeof input !== 'object') throw new Error('Missing creative brief.');
  const brief = clampText(input.brief, 1200);
  const characterName = clampText(input.characterName, 70);
  const characterDescription = clampText(input.characterDescription, 600);
  const style = STYLES.includes(input.style) ? input.style : STYLES[0];
  const platform = PLATFORMS.includes(input.platform) ? input.platform : PLATFORMS[0];
  const duration = Number(input.duration);
  const shotCount = Number(input.shotCount);
  if (brief.length < 12) throw new Error('Please write at least 12 characters describing your idea.');
  if (![15, 30, 60].includes(duration)) throw new Error('Duration must be 15, 30 or 60 seconds.');
  if (!Number.isInteger(shotCount) || shotCount < 3 || shotCount > 8) throw new Error('Shot count must be between 3 and 8.');
  return { brief, characterName, characterDescription, style, platform, duration, shotCount };
}

export function distributeTime(duration, count) {
  const base = Math.floor(duration / count);
  return Array.from({ length: count }, (_, i) => base + (i < duration % count ? 1 : 0));
}

export function normalizeShots(input, proposed, mode = 'demo') {
  const durations = distributeTime(input.duration, input.shotCount);
  if (!Array.isArray(proposed) || proposed.length !== input.shotCount) throw new Error(`Expected ${input.shotCount} shots from the generator.`);
  let offset = 0;
  return {
    title: typeof input.projectTitle === 'string' && input.projectTitle.trim() ? input.projectTitle.slice(0, 90) : 'Untitled production',
    brief: input.brief,
    characterName: input.characterName,
    characterDescription: input.characterDescription,
    style: input.style,
    platform: input.platform,
    duration: input.duration,
    mode,
    generatedAt: new Date().toISOString(),
    shots: proposed.map((raw, i) => {
      const entry = raw && typeof raw === 'object' ? raw : {};
      const durationSec = durations[i];
      const shot = {
        id: `shot-${i + 1}`,
        index: i + 1,
        startSec: offset,
        endSec: offset + durationSec,
        durationSec,
        title: clampText(entry.title, 110) || `Shot ${i + 1}`,
        camera: clampText(entry.camera, 180) || angles[i % angles.length][2],
        action: clampText(entry.action, 400) || 'Continue the scene naturally.',
        lighting: clampText(entry.lighting, 250) || 'Natural, consistent scene lighting.',
        continuity: clampText(entry.continuity, 380) || 'Maintain identity, props and lighting.',
        prompt: clampText(entry.prompt, 2400) || `${input.brief}. ${input.style}. ${entry.action || ''}`
      };
      offset += durationSec;
      return shot;
    })
  };
}

export function buildDemoProject(input) {
  const clean = validateBrief(input);
  const projectTitle = (clean.brief.split(/[.!?。！？，,\n]/)[0] || 'New story').trim().slice(0, 65);
  const generated = Array.from({ length: clean.shotCount }, (_, i) => {
    const angle = angles[i % angles.length];
    const phase = i === 0 ? 'opening' : i === clean.shotCount - 1 ? 'closing' : 'middle';
    const identity = clean.characterDescription
      ? `${clean.characterName || 'Main character'}: ${clean.characterDescription}`
      : clean.characterName ? `${clean.characterName}, retain the same appearance in every shot` : 'Maintain the same subject appearance in each shot';
    const action = `${angle[1]}. Interpret the ${phase} beat of this concept: ${clean.brief}`;
    const lighting = clean.style === 'Suspense / thriller'
      ? 'Low-key practical lighting, restrained contrast and believable shadows'
      : clean.style === 'Soft lifestyle'
        ? 'Soft ambient light, authentic skin texture and understated highlights'
        : 'Controlled, believable lighting appropriate to the established setting';
    return {
      title: angle[0], camera: angle[2], action, lighting,
      continuity: `Keep ${identity}. Preserve wardrobe, scene direction and atmosphere across adjacent shots.`,
      prompt: [
        `SHOT ${String(i + 1).padStart(2, '0')} — ${angle[0]}.`,
        `Scene concept: ${clean.brief}.`,
        `Production style: ${clean.style}; format: ${clean.platform}.`,
        `Camera: ${angle[2]}. Action: ${angle[1]}.`,
        `Lighting: ${lighting}.`,
        `Identity lock: ${identity}.`,
        'Maintain plausible physics, natural motion, coherent background and visual continuity. No subtitles, no logos, no unwanted spoken dialogue.'
      ].join(' ')
    };
  });
  return normalizeShots({ ...clean, projectTitle }, generated, 'demo');
}

export const SHOT_SCHEMA = {
  type: 'object', additionalProperties: false,
  properties: {
    projectTitle: { type: 'string' },
    shots: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      properties: {
        title: { type: 'string' }, camera: { type: 'string' },
        action: { type: 'string' }, lighting: { type: 'string' },
        continuity: { type: 'string' }, prompt: { type: 'string' }
      },
      required: ['title', 'camera', 'action', 'lighting', 'continuity', 'prompt']
    } }
  }, required: ['projectTitle', 'shots']
};

export function projectToMarkdown(project) {
  const lines = [
    `# ${project.title}`,
    '', `> ${project.duration}s / ${project.style} / ${project.platform}`,
    '', '## Creative brief', '', project.brief, '', '## Character bible', '',
    `- Name: ${project.characterName || 'Not specified'}`,
    `- Identity: ${project.characterDescription || 'Not specified'}`, '',
    '## Storyboard'
  ];
  for (const shot of project.shots) {
    lines.push('', `### Shot ${shot.index}: ${shot.title} (${shot.startSec}–${shot.endSec}s)`, '',
      `- Camera: ${shot.camera}`, `- Action: ${shot.action}`, `- Lighting: ${shot.lighting}`,
      `- Continuity: ${shot.continuity}`, '', '**Generation prompt**', '', shot.prompt);
  }
  lines.push('', `Generated by Velneris Studio (${project.mode === 'claude' ? 'Claude API' : 'deterministic demonstration mode'}).`);
  return lines.join('\n');
}
