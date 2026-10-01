import { execFileSync } from 'node:child_process';
import { COMMIT_TYPES } from '../../commitlint.config.mjs';

export const PROTECTED_BRANCH = 'main';

const BRANCH_NAME_PATTERN = new RegExp(`^(${COMMIT_TYPES.join('|')})/[a-z0-9]+(-[a-z0-9]+)*$`);
const DETACHED_HEAD = 'HEAD';

export function readCurrentBranch() {
  return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { encoding: 'utf8' }).trim();
}

export function isDetachedHead(branchName) {
  return branchName === DETACHED_HEAD;
}

export function isProtectedBranch(branchName) {
  return branchName === PROTECTED_BRANCH;
}

export function hasValidBranchName(branchName) {
  return BRANCH_NAME_PATTERN.test(branchName);
}

export function explainBranchNaming() {
  return [
    `Use uma branch no formato tipo/descricao, por exemplo feat/funil-kanban ou fix/busca-de-leads.`,
    `Tipos aceitos (os mesmos do commitlint): ${COMMIT_TYPES.join(', ')}.`,
    `A descrição usa letras minúsculas, números e hífens.`,
  ].join('\n');
}

export function refuse(reason) {
  console.error(`\n✖ ${reason}\n`);
  process.exit(1);
}
