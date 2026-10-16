#!/usr/bin/env node
// Is branch protection on `main` still on, and does it still require the check that actually exists?
// Reads only what a normal read token can see (GET /branches/main). Needs no admin token and changes nothing.
//   GITHUB_REPOSITORY=owner/repo GH_TOKEN=... node tests/support/check-protection.js
// Exit 0 = fine, 1 = problem (the workflow then opens the one "protection-off" issue).
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const REQUIRED_JOB = 'Browser tests (pretend Google and Drive)';

/** Pure decision, so it can be tested without GitHub. branch = the JSON from GET /branches/main. */
function evaluate(branch, workflowText) {
  const problems = [];
  const notes = [];
  if (!branch || branch.protected !== true) problems.push('`main` has NO branch protection. Anyone with write access can push straight to it.');
  const rsc = branch && branch.protection && branch.protection.required_status_checks;
  if (branch && branch.protected === true) {
    if (!branch.protection) notes.push('This token cannot see the rule details, so only "protection is on" was checked.');
    else {
      if (branch.protection.enabled === false) problems.push('The protection rule exists but is switched off.');
      const contexts = (rsc && rsc.contexts) || [];
      if (!contexts.includes(REQUIRED_JOB)) problems.push(`The rule no longer requires the check "${REQUIRED_JOB}". It requires: ${contexts.join(', ') || 'nothing'}.`);
      if (rsc && rsc.enforcement_level && rsc.enforcement_level !== 'everyone') problems.push(`The rule is not enforced for everyone (it is "${rsc.enforcement_level}"). Admins can bypass it.`);
    }
  }
  if (!new RegExp('^\\s*name:\\s*' + REQUIRED_JOB.replace(/[()]/g, '\\$&') + '\\s*$', 'm').test(workflowText || '')) {
    problems.push(`No job in tests.yml is called "${REQUIRED_JOB}". The required check would wait forever and nothing could merge.`);
  }
  return { problems, notes };
}

module.exports = { evaluate, REQUIRED_JOB };

if (require.main === module) {
  const repo = process.env.GITHUB_REPOSITORY;
  if (!repo) { console.error('Set GITHUB_REPOSITORY=owner/repo'); process.exit(2); }
  const branch = JSON.parse(execFileSync('gh', ['api', `repos/${repo}/branches/main`], { encoding: 'utf8' }));
  const wf = fs.readFileSync(path.join(__dirname, '..', '..', '.github', 'workflows', 'tests.yml'), 'utf8');
  const { problems, notes } = evaluate(branch, wf);
  const lines = [problems.length ? '## ❌ Branch protection needs a look' : '## ✅ Branch protection is on', ''];
  problems.forEach((p) => lines.push('- ' + p));
  notes.forEach((n) => lines.push('- (note) ' + n));
  if (!problems.length) lines.push(`- \`main\` is protected and requires "${REQUIRED_JOB}".`);
  const text = lines.join('\n') + '\n';
  if (process.env.GITHUB_STEP_SUMMARY) fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  process.stdout.write(text);
  process.exit(problems.length ? 1 : 0);
}
