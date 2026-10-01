import { readFileSync } from 'node:fs';
import { explainBranchNaming, hasValidBranchName, isProtectedBranch, PROTECTED_BRANCH, refuse } from './branch-rules.mjs';

const BRANCH_REF_PREFIX = 'refs/heads/';

function readPushedBranches() {
  const pushedRefs = readFileSync(0, 'utf8').split('\n').filter((pushedRef) => pushedRef.trim());
  return pushedRefs
    .map((pushedRef) => pushedRef.split(' ')[2] ?? '')
    .filter((remoteRef) => remoteRef.startsWith(BRANCH_REF_PREFIX))
    .map((remoteRef) => remoteRef.slice(BRANCH_REF_PREFIX.length));
}

for (const pushedBranch of readPushedBranches()) {
  if (isProtectedBranch(pushedBranch)) {
    refuse(
      `Envio direto para a ${PROTECTED_BRANCH} não é permitido.\n` +
        `Envie a sua branch (git push -u origin tipo/descricao) e abra um pull request; a ${PROTECTED_BRANCH} só muda pelo merge do PR.`,
    );
  }
  if (!hasValidBranchName(pushedBranch)) {
    refuse(`A branch "${pushedBranch}" está fora do padrão.\n${explainBranchNaming()}`);
  }
}
