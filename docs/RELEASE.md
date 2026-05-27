# Release Process

This document describes how versioning and releases work for `k8s-mcp`.

## Branch Strategy

We use a **branch-based** workflow to control when builds are published:

| Branch | Purpose | Push Behavior |
|--------|---------|---------------|
| `dev` | Daily development | ❌ No publish |
| `master` | Stable / ready to publish | ✅ Auto-publish dev build |
| `v*` tag | Production release | ✅ Publish release version |

### Workflow

```bash
# 1. Develop on dev branch
git checkout dev
# ... make changes ...
git commit -m "feat: update inspect"
git push origin dev        # Does NOT publish

# 2. Merge to master when ready to publish
git checkout master
git merge dev
git push origin master     # Triggers auto-publish

# 3. Create release tag (optional, for production)
git tag v0.1.3
git push origin v0.1.3     # Triggers release publish
```

---

## Version Strategy

We use a **dual-track** release system:

| Track | Trigger | Version Format | Registry |
|-------|---------|---------------|----------|
| **Development** | Push to `master` | `X.Y.Z` (auto-increment patch) | PyPI + npm |
| **Release** | Git tag `v*` | `X.Y.Z` (from tag) | PyPI + npm + GitHub Release |

## How It Works

### 1. Development Builds (Automatic)

Push to `master` automatically publishes a development build.

**Version calculation:**
```
Base Version (from pyproject.toml) + Auto-increment patch
Example: 0.1.2 → 0.1.3 → 0.1.4 (skips existing versions)
```

**What happens:**
1. CI reads the base version from `pyproject.toml`
2. Auto-increments patch until finding an unused version on PyPI
3. Updates version in source files
4. Publishes to PyPI and npm
5. Commits version bump with `[skip ci]`

### 2. Release Builds (Manual)

Create a new release by pushing a version tag.

**Version format:**
```
v{major}.{minor}.{patch}
Example: v0.1.3
```

**What happens:**
1. CI extracts version from tag (e.g., `v0.1.3` → `0.1.3`)
2. Updates `pyproject.toml`, `package.json`, `src/k8s_mcp/__init__.py`
3. Commits the version bump with `[release] [skip ci]`
4. Creates GitHub Release with auto-generated notes
5. Publishes to PyPI and npm

---

## How to Release a New Version

### Development Build (Auto)

Just push to `master`:

```bash
git checkout master
git merge dev
git push origin master     # Auto-publishes dev version
```

### Production Release (Manual)

#### Option 1: Command Line (Recommended)

```bash
# 1. Ensure you're on master and up to date
git checkout master
git pull origin master

# 2. Create and push the tag
git tag v0.1.3
git push origin v0.1.3

# Done! CI will handle the rest.
```

#### Option 2: GitHub Web UI

1. Go to **Releases** → **Draft a new release**
2. Click **Choose a tag** → Type `v0.1.3` → **Create new tag**
3. Fill in release title and notes (or auto-generate)
4. Click **Publish release**

#### Option 3: GitHub CLI

```bash
gh release create v0.1.3 --generate-notes
```

---

## Version Files

These files contain the current base version:

| File | Format | Updated By |
|------|--------|-----------|
| `pyproject.toml` | `version = "0.1.2"` | Release CI |
| `package.json` | `"version": "0.1.2"` | Release CI |
| `src/k8s_mcp/__init__.py` | `__version__ = "0.1.2"` | Release CI |

**Note:** Do not manually edit these files for development builds. Only edit them when you want to change the base version before releasing.

---

## CI Workflows

### `.github/workflows/auto-build.yml`

- **Trigger:** Push to `master`/`main`
- **Behavior:** Publishes development build with auto-incremented patch version

### `.github/workflows/release.yml`

- **Trigger:** Push tag matching `v*`
- **Behavior:** Updates version files, commits, creates release, publishes

---

## FAQ

### Q: Why use separate `dev` and `master` branches?

This allows you to push multiple commits during development without triggering publishes. Only when you merge to `master` does the auto-publish happen.

### Q: Can I push directly to `master`?

Yes, but every push will trigger a publish. Use `dev` branch for work-in-progress.

### Q: What if the tag version doesn't match pyproject.toml?

The release workflow **overrides** the version in `pyproject.toml` with the tag version. You don't need to manually sync them before tagging.

### Q: How do I bump the major or minor version?

Just use a larger version number in the tag:
```bash
git tag v1.0.0   # major
git tag v0.2.0   # minor
git tag v0.1.4   # patch (default)
```
