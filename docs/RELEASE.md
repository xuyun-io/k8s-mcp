# Release Process

This document describes how versioning and releases work for `k8s-mcp`.

## Version Strategy

We use a **dual-track** release system:

| Track | Trigger | Version Format | Registry |
|-------|---------|---------------|----------|
| **Development** | Push to `master` | `0.1.2.post47` (PyPI), `0.1.2-build.47` (npm) | PyPI + npm |
| **Release** | Git tag `v*` | `0.1.3` | PyPI + npm + GitHub Release |

## How It Works

### 1. Development Builds (Automatic)

Every push to `master` automatically publishes a development build.

**Version calculation:**
```
Base Version (from pyproject.toml) + Commit Count
Example: 0.1.2 + 47 commits → 0.1.2.post47 (PyPI) / 0.1.2-build.47 (npm)
```

**What happens:**
1. CI reads the base version from `pyproject.toml`
2. Counts total commits: `git rev-list --count HEAD`
3. Publishes to PyPI and npm with the build version
4. **Does NOT modify source code**
5. **Does NOT create git tags**

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

### Option 1: Command Line (Recommended)

```bash
# 1. Ensure you're on master and up to date
git checkout master
git pull origin master

# 2. Create and push the tag
git tag v0.1.3
git push origin v0.1.3

# Done! CI will handle the rest.
```

### Option 2: GitHub Web UI

1. Go to **Releases** → **Draft a new release**
2. Click **Choose a tag** → Type `v0.1.3` → **Create new tag**
3. Fill in release title and notes (or auto-generate)
4. Click **Publish release**

### Option 3: GitHub CLI

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
- **Skip conditions:** Commit message contains `[skip ci]` or `[release]`
- **Behavior:** Publishes development build without modifying source

### `.github/workflows/release.yml`

- **Trigger:** Push tag matching `v*`
- **Behavior:** Updates version files, commits, creates release, publishes

---

## FAQ

### Q: Why are there two different version formats?

**PyPI** uses PEP 440: `0.1.2.post47`
**npm** uses semver: `0.1.2-build.47`

They are different registries with different standards.

### Q: Will development builds clutter PyPI/npm?

Yes, every push creates a new version. If this becomes a problem, we can:
- Switch to publishing dev builds only on schedule (e.g., nightly)
- Use a separate dev registry

### Q: Can I skip the auto-build?

Yes, include `[skip ci]` in your commit message:
```bash
git commit -m "docs: update README [skip ci]"
```

### Q: What if the tag version doesn't match pyproject.toml?

The release workflow **overrides** the version in `pyproject.toml` with the tag version. You don't need to manually sync them before tagging.

### Q: How do I bump the major or minor version?

Just use a larger version number in the tag:
```bash
git tag v1.0.0   # major
git tag v0.2.0   # minor
git tag v0.1.4   # patch (default)
```
