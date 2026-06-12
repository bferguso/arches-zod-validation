"""Umbrella command orchestrating the full API codegen pipeline:

    1. generate_graph_views        (in-process: it only writes files)
    2. manage.py spectacular       (fresh subprocess -- see below)
    3. npm run openapi:zod         (subprocess: Node)

Why step 2 is a subprocess and not call_command(): Django's startup system
checks import the URLconf, so THIS process may already hold the previous
generation of ``<project>.views.generated`` / ``urls_api_generated`` in
sys.modules. An in-process spectacular run would document the stale modules.
A fresh interpreter imports the files step 1 just wrote.

Usage:

    python manage.py regenerate_api
    python manage.py regenerate_api --check          # CI: fail if artifacts drifted
    python manage.py regenerate_api --skip-views     # graphs unchanged; redo 2+3 only
    python manage.py regenerate_api --skip-zod       # backend-only environments

Place at:
    arches_zod_validation/management/commands/regenerate_api.py
"""

import shutil
import subprocess
import sys
from pathlib import Path

from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from .generate_graph_views import default_project_name


class Command(BaseCommand):
    help = (
        "Run the full API codegen pipeline: generated views -> OpenAPI spec "
        "(drf_spectacular) -> zod client (openapi-ts)."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--project",
            default=None,
            help="Project package name (default: auto-detected, e.g. 'bcrhp').",
        )
        parser.add_argument(
            "--urlconf",
            default=None,
            help=(
                "Urlconf for spectacular " "(default: <project>.urls_api_documented)."
            ),
        )
        parser.add_argument(
            "--schema-file",
            default="schema.yml",
            help="OpenAPI spec output file. Default: schema.yml",
        )
        parser.add_argument(
            "--zod-cmd",
            default=None,
            help=(
                "Override the zod-generation command (space-separated). "
                "Default: the project's node_modules/.bin/openapi-ts, "
                "falling back to 'npx --no-install openapi-ts'."
            ),
        )
        parser.add_argument(
            "--skip-views",
            action="store_true",
            help="Skip step 1 (use the committed generated views as-is).",
        )
        parser.add_argument(
            "--skip-zod",
            action="store_true",
            help="Skip step 3 (e.g. backend-only environments without npm).",
        )
        parser.add_argument(
            "--check",
            action="store_true",
            help=(
                "After regenerating, fail if any pipeline-owned artifact "
                "differs from the git index (CI drift check)."
            ),
        )

    def banner(self, text):
        self.stdout.write(self.style.MIGRATE_HEADING(f"\n==> {text}"))

    def run_subprocess(self, argv, step, cwd=None):
        self.stdout.write(f"    $ {' '.join(str(a) for a in argv)}")
        result = subprocess.run(argv, cwd=cwd)
        if result.returncode != 0:
            raise CommandError(
                f"{step} failed (exit {result.returncode}); aborting pipeline."
            )

    def resolve_manage_py(self):
        """The manage.py this process was started with, for re-invocation."""
        candidate = Path(sys.argv[0]).resolve()
        if candidate.name != "manage.py" or not candidate.exists():
            raise CommandError(
                "Could not locate manage.py from sys.argv[0] "
                f"(got {candidate}). Run this command via manage.py."
            )
        return candidate

    def resolve_zod_cmd(self, override, repo_root):
        """Command vector for openapi-ts, preferring the project's pinned copy.

        Order: explicit --zod-cmd override; the binary npm installed into the
        project's node_modules/.bin (version pinned by the lockfile); then
        'npx --no-install openapi-ts' (still local-only: --no-install refuses
        to silently fetch an arbitrary latest version).
        """
        if override:
            return override.split()
        local_bin = repo_root / "node_modules" / ".bin" / "openapi-ts"
        if local_bin.exists():
            return [str(local_bin)]
        npx = shutil.which("npx")
        if npx:
            return [npx, "--no-install", "openapi-ts"]
        raise CommandError(
            "openapi-ts not found. Add @hey-api/openapi-ts to the project's "
            "devDependencies and run 'npm install', or pass --skip-zod."
        )

    def handle(self, *args, **options):
        project = options["project"] or default_project_name()
        urlconf = options["urlconf"] or f"{project}.urls_api_documented"
        schema_file = options["schema_file"]
        manage_py = self.resolve_manage_py()
        repo_root = manage_py.parent

        # --- Step 1: generated views + urls (in-process; writes only) -------
        if options["skip_views"]:
            self.banner("Step 1/3: generate_graph_views (skipped)")
        else:
            self.banner("Step 1/3: generate_graph_views")
            call_command(
                "generate_graph_views",
                project=project,
                schema_file=schema_file,
                overwrite=True,  # pipeline runs must be deterministic
            )

        # --- Step 2: OpenAPI spec (MUST be a fresh process) -----------------
        self.banner("Step 2/3: drf_spectacular schema")
        self.run_subprocess(
            [
                sys.executable,
                str(manage_py),
                "spectacular",
                "--urlconf",
                urlconf,
                "--file",
                schema_file,
                "--validate",
                "--fail-on-warn",
            ],
            step="spectacular",
            cwd=repo_root,
        )

        # --- Step 3: zod client via openapi-ts -------------------------------
        # Invoked directly (no package.json script needed). openapi-ts reads
        # openapi-ts.config.ts from cwd, which step 1 scaffolds at repo root.
        if options["skip_zod"]:
            self.banner("Step 3/3: zod generation (skipped)")
        else:
            self.banner("Step 3/3: zod generation (openapi-ts)")
            argv = self.resolve_zod_cmd(options["zod_cmd"], repo_root)
            self.run_subprocess(argv, step="openapi-ts", cwd=repo_root)

        # --- Optional CI drift check -----------------------------------------
        if options["check"]:
            self.banner("Drift check")
            owned = [
                schema_file,
                f"{project}/views/generated",
                f"{project}/urls_api_generated.py",
                f"{project}/src/{project}/client",
            ]
            git = shutil.which("git")
            if git is None:
                raise CommandError("--check requires git on PATH.")
            result = subprocess.run(
                [git, "diff", "--exit-code", "--", *owned], cwd=repo_root
            )
            if result.returncode != 0:
                raise CommandError(
                    "Generated API artifacts are stale. Run "
                    "'python manage.py regenerate_api' and commit the changes."
                )
            self.stdout.write(self.style.SUCCESS("    No drift detected."))

        self.stdout.write(
            self.style.SUCCESS(
                f"\nAPI codegen pipeline complete ({schema_file}, "
                f"{project}/views/generated, {project}/urls_api_generated.py"
                + ("" if options["skip_zod"] else f", {project}/src/{project}/client")
                + ")."
            )
        )
