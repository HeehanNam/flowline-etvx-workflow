"""Fetch remote history and recover missing tracked files, never overwrite files.

Recovery uses HEAD (the currently installed version), not origin/main, so a
fetch cannot accidentally mix new upstream files with older local code.
"""
import os
from pathlib import Path, PurePosixPath
import subprocess
import sys


ROOT = Path(__file__).resolve().parent


def git(root, *args):
    return subprocess.run(
        ["git", "-c", "safe.directory=" + root.as_posix(), *args],
        cwd=root, stdout=subprocess.PIPE, stderr=subprocess.PIPE, check=True,
    ).stdout


def restore_missing(root):
    root = root.resolve()
    # Read blobs directly from the committed tree. Leave index, local edits,
    # untracked files and ignored databases untouched.
    entries = git(root, "ls-tree", "-r", "-z", "HEAD").split(b"\0")
    restored = []
    for entry in entries:
        if not entry:
            continue
        metadata, raw_path = entry.split(b"\t", 1)
        mode, kind, oid = metadata.split()
        if kind != b"blob" or mode not in (b"100644", b"100755"):
            continue
        relative = PurePosixPath(os.fsdecode(raw_path))
        target = root.joinpath(*relative.parts)
        # Reject traversal and symlink parents, even if the committed path is odd.
        if relative.is_absolute() or ".." in relative.parts or not target.resolve().is_relative_to(root):
            raise RuntimeError("Unsafe tracked path: " + str(relative))
        if any(parent.is_symlink() for parent in target.parents if parent != root):
            raise RuntimeError("Symlink parent: " + str(relative))
        if os.path.lexists(target):
            continue
        content = git(root, "cat-file", "blob", oid.decode("ascii"))
        target.parent.mkdir(parents=True, exist_ok=True)
        try:
            with target.open("xb") as output:
                output.write(content)
        except FileExistsError:
            continue
        restored.append(str(relative))
        print("Restored: " + str(relative))
    return restored


def main():
    try:
        top = Path(os.fsdecode(git(ROOT, "rev-parse", "--show-toplevel")).strip()).resolve()
        if top != ROOT:
            raise RuntimeError("Place this script in the repository root.")
        fetch_failed = False
        try:
            print("Fetching origin...", flush=True)
            git(ROOT, "fetch", "origin")
        except subprocess.CalledProcessError as error:
            fetch_failed = True
            print("Fetch failed. Recovering from the local HEAD instead.")
            print(error.stderr.decode(errors="replace"))
        restored = restore_missing(ROOT)
        print("Recovered %d file(s). Existing files and DB were not changed." % len(restored))
        print("Source: local HEAD. No pull, merge, reset or deletion was performed.")
        return 1 if fetch_failed else 0
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print("Recovery failed: " + str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    sys.exit(main())
