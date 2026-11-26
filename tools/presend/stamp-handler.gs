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

