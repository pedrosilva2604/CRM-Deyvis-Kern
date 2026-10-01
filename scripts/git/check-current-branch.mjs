import {
  explainBranchNaming,
  hasValidBranchName,
  isDetachedHead,
  isProtectedBranch,
  PROTECTED_BRANCH,
  readCurrentBranch,
  refuse,
} from './branch-rules.mjs';

const ACTION_BY_HOOK = {
  commit: 'Commits',
  merge: 'Merges',
};

const hookAction = ACTION_BY_HOOK[process.argv[2]] ?? ACTION_BY_HOOK.commit;
const currentBranch = readCurrentBranch();

if (!isDetachedHead(currentBranch)) {
  if (isProtectedBranch(currentBranch)) {
    refuse(
      `${hookAction} direto na ${PROTECTED_BRANCH} não são permitidos.\n` +
        `Crie uma branch (git switch -c tipo/descricao), envie e abra um pull request.\n` +
        explainBranchNaming(),
    );
  }
  if (!hasValidBranchName(currentBranch)) {
    refuse(`A branch "${currentBranch}" está fora do padrão.\n${explainBranchNaming()}`);
  }
}
