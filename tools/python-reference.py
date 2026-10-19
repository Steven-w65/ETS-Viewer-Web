"""Read-only comparison adapter. No ETS data is bundled with the web app."""
import sys
sys.dont_write_bytecode = True
import json
from pathlib import Path
from dataclasses import asdict

desktop, bank = map(Path, sys.argv[1:3])
sys.path.insert(0, str(desktop.resolve()))
from core.scanner import scan_bank, task_folder
from core.exporter import format_answers

result = scan_bank(bank)
questions = []
papers = {}
for question in result.questions:
    q = asdict(question)
    q['source'] = bank.name + '/' + question.source.relative_to(bank).as_posix()
    q['keyPoints'] = q.pop('key_points')
    questions.append(q)
    key = bank.name + '/' + task_folder(question.source).relative_to(bank).as_posix()
    papers.setdefault(key, []).append(question)
payload = {
    'questions': questions,
    'exports': {key: format_answers(key.split('/')[-1], groups) for key, groups in papers.items()},
    'filesScanned': result.files_scanned,
    'issues': len(result.issues),
}
sys.stdout.buffer.write(json.dumps(payload, ensure_ascii=False).encode('utf-8'))
