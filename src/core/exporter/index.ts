import { questionKindLabel, type Question } from '../../types';
import { plainText } from '../markup';
export function exportFilename(task: string): string {
  // Same Windows-safe names as the desktop exporter, even when used on mobile.
  let name = task
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '_')
    .trim()
    .replace(/[ .]+$/, '');
  if (!name) name = 'ETS-answers';
  if (/^(CON|PRN|AUX|NUL|COM[1-9¹²³]|LPT[1-9¹²³])$/i.test(name.split('.')[0])) name = '_' + name;
  return name + '.txt';
}
export function formatAnswers(task: string, questions: readonly Question[]): string {
  const lines = [
    'ETS-Viewer answer export',
    `Task: ${task}`,
    'Only the first stored answer for each question is included.',
    '',
  ];
  for (const q of questions) {
    lines.push('='.repeat(72), `Question group: ${q.id}`, questionKindLabel(q));
    for (const [label, value] of [
      ['Topic', q.topic],
      ['Instructions', q.instructions],
      ['Context', q.context],
    ])
      if (value) lines.push('', label + ':', plainText(value));
    for (const material of q.sharedMaterials || [])
      if (material.text) lines.push('', material.label + ':', plainText(material.text));
    for (const p of q.parts) {
      const number = p.officialNumber || p.number;
      lines.push('', 'Question: ' + q.id + (number ? '/' + number : ''));
      if (p.prompt) lines.push(plainText(p.prompt));
      if (p.context) lines.push('', 'Context:', plainText(p.context));
      if (p.translation) lines.push('', 'Translation:', plainText(p.translation));
      if (p.options.length)
        lines.push(
          '',
          'Options:',
          ...p.options.map(
            (o) =>
              `${plainText(o.label)}. ${[plainText(o.text), ...(o.images || []).map((ref) => '[Image: ' + ref.replace(/[\r\n]/g, ' ') + ']')].filter(Boolean).join(' ')}`,
          ),
        );
      for (const supplement of p.supplements || [])
        if (supplement.text) lines.push('', supplement.label + ':', plainText(supplement.text));
      lines.push(
        '',
        '-'.repeat(72),
        'Answer:',
        p.answers.length ? plainText(p.answers[0].text) : 'Answer not found',
        '-'.repeat(72),
      );
    }
    lines.push('');
  }
  return lines.join('\n') + '\n';
}
export const exportBytes = (task: string, questions: readonly Question[]) =>
  new TextEncoder().encode('\uFEFF' + formatAnswers(task, questions));
export function downloadPaper(task: string, questions: readonly Question[]) {
  const blob = new Blob([exportBytes(task, questions)], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob),
    anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = exportFilename(task);
  document.body.append(anchor);
  try {
    anchor.click();
  } finally {
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 30_000);
  }
}
