/* ---------- presend stamp (proposal approved by Lisa's default A, 30 Oct 2026; deploy by the Mac route after the Send gate PR merges) ----------
 * AF › requests › stamp-<draft>-<time>.json, written by tools/presend/prompt-lint.py --presend:
 *   { kind: 'stamp', taskId, line, sha256, ready, at, by }
 * Posts `line` as ONE comment on that Sends task, exactly as written (no "Claude: " prefix, so the Factory
 * Send gate reads it with ^presend:). Never touches status, fields or the description.
 * Wire-in (one line in pickupRequests_, beside the other kinds):
 *   else if (r.kind === 'stamp') stamp_(s, r);
 * A bad file throws, so pickupRequests_ renames it FAILED-, logs it and raises an incident, as for every kind. */
var STAMP_LINE = /^presend: (READY sha256:[0-9a-f]{64} \S.*|NOT READY .+)$/;
function stamp_(s, r) {
  var line = String(r.line || ''), id = String(r.taskId || '');
  if (!/^[a-z0-9]+$/i.test(id) || line.length > 300 || !STAMP_LINE.test(line)) throw new Error('bad stamp request');
  var ready = /^presend: READY /.test(line);
  if (ready !== (r.ready === true)) throw new Error('stamp ready flag does not match its line');
  if (ready && line.indexOf('sha256:' + String(r.sha256 || '') + ' ') < 0) throw new Error('stamp sha256 does not match its line');
  var t = cu_('get', '/task/' + id);
  if (String(t.list && t.list.id) !== String(s.CLICKUP_LIST_SENDS)) throw new Error('not a Sends task: ' + id);
  cu_('post', '/task/' + id + '/comment', { comment_text: line });
  log_('stamp', 'OK', id, (ready ? 'READY ' : 'NOT READY ') + String(r.sha256 || '').slice(0, 12));
}
