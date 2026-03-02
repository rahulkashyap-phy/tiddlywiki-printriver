# Exporting to a new private `tw2tex` repository

This file provides step-by-step instructions for creating the private
`rahulkashyap-phy/tw2tex` GitHub repository and populating it with the full
commit history carried in the included git bundle.

---

## What's in `exports/tw2tex-export.bundle`

The bundle contains **all commits** from this repository branch
(these are the historical commits that `tw2tex` was built from):

| Commit | Description |
|--------|-------------|
| `ea2091e` | Initial PrintRiver plugin files — parent project baseline |
| `7ac61b9` | LaTeX export feature added to PrintRiver — the core of tw2tex |

The bundle was created with:

```bash
git bundle create exports/tw2tex-export.bundle HEAD
```

It is self-contained and requires no network access to extract.

---

## Step 1 – Create the private `tw2tex` repository on GitHub

1. Go to <https://github.com/new>
2. Set:
   - **Repository name**: `tw2tex`
   - **Visibility**: ☑ Private
   - **Do NOT** initialise with a README, `.gitignore`, or licence
3. Click **Create repository**

---

## Step 2 – Clone from the bundle (no GitHub clone needed)

```bash
# Download tw2tex-export.bundle from:
# https://github.com/rahulkashyap-phy/tiddlywiki-printriver/raw/copilot/convert-markdown-html-to-tex/exports/tw2tex-export.bundle

git clone exports/tw2tex-export.bundle tw2tex-local
cd tw2tex-local
```

---

## Step 3 – Push to the new private repository

```bash
# Replace with your new repo URL
git remote set-url origin https://github.com/rahulkashyap-phy/tw2tex.git

# Push all commits to main (GitHub's default branch)
git push --set-upstream origin HEAD:main
```

Or if you want to preserve the branch name `tw2tex`:

```bash
git push --set-upstream origin HEAD:tw2tex
```

---

## Step 4 – Verify

```bash
git --no-pager log --oneline
# Should show both commits:
# 7ac61b9 Add LaTeX export feature: startup module, button, settings UI, config defaults, docs
# ea2091e Initial plan
```

---

## One-liner (all steps combined)

```bash
git clone exports/tw2tex-export.bundle tw2tex-local \
  && cd tw2tex-local \
  && git remote set-url origin https://github.com/rahulkashyap-phy/tw2tex.git \
  && git push --set-upstream origin HEAD:main
```

---

## Branch `tw2tex` in the current repository

All commits are already on the `copilot/convert-markdown-html-to-tex` branch.
To create the **`tw2tex`** branch in `tiddlywiki-printriver`, run **one command**
(no clone needed):

```bash
# From any machine that has the repo cloned, or via GitHub CLI:
git push origin origin/copilot/convert-markdown-html-to-tex:refs/heads/tw2tex
```

Or via the **GitHub web UI**:
1. Go to **Code → Branches**
2. Click **New branch**
3. Name it `tw2tex`, base it on `copilot/convert-markdown-html-to-tex`
4. Click **Create branch**

After that step the branch `tw2tex` will exist on GitHub with the full commit
history, and you can proceed with the export instructions above.

---

## Regenerating the bundle

If new commits have been added and you need a fresh bundle:

```bash
cd /path/to/tiddlywiki-printriver
git bundle create exports/tw2tex-export.bundle HEAD
git bundle verify exports/tw2tex-export.bundle
```

Commit and push the updated bundle, then re-download before running Step 2.
