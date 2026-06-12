"""Scaffold the project files the API codegen pipeline expects, so the
pipeline works on a project that has never run it.

Everything is write-if-missing: re-running is a no-op and existing files
are never modified, so this is safe to run unconditionally (regenerate_api
runs it as step 0 on every invocation).

Files scaffolded into the project package (e.g. ``bcrhp``):

    urls_api_generated.py      stub with ``urlpatterns = []`` -- lets the
                               project's urls.py contain a plain,
                               unconditional include() with no existence
                               guards, even before the first generation.
                               Overwritten with real routes by
                               generate_graph_views.
    urls_api_documented.py     the urlconf spectacular documents; includes
                               urls_api_generated. Yours to edit after
                               scaffolding -- NEVER overwritten.

Place at:
    arches_zod_validation/management/commands/bootstrap_api.py
Template:
    arches_zod_validation/management/commands/templates/urls_api_documented.py-tpl
"""

from django.core.management.base import BaseCommand
from django.template import Context, Engine

from .generate_graph_views import (
    TEMPLATE_DIR,
    default_project_name,
    resolve_project_dir,
)

GENERATED_URLS_STUB = '''"""Placeholder until the first generation run.

Replaced with real routes by ``manage.py generate_graph_views``; committing
this stub lets urls.py include() it unconditionally.
"""

urlpatterns = []
'''


class Command(BaseCommand):
    # Deliberately skip system checks: on a fresh project the ROOT_URLCONF
    # may include() the not-yet-existing urls_api_generated module, and the
    # default checks import the URLconf -- they would fail before this
    # command could create the very stub that fixes them. Safe to skip:
    # this command only writes files and touches no Django machinery.
    requires_system_checks = []

    help = (
        "Scaffold first-run files for the API codegen pipeline "
        "(urls_api_generated.py stub, urls_api_documented.py). "
        "Write-if-missing; never modifies existing files."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--project",
            default=None,
            help="Project package name (default: auto-detected, e.g. 'bcrhp').",
        )
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Report what would be scaffolded without writing.",
        )

    def scaffold(self, path, content, dry_run):
        if path.exists():
            self.stdout.write(f"    {path.name}: exists, left untouched.")
            return
        if dry_run:
            self.stdout.write(f"    {path.name}: [dry-run] would scaffold.")
            return
        path.write_text(content, encoding="utf-8")
        self.stdout.write(self.style.SUCCESS(f"    {path.name}: scaffolded."))

    def handle(self, *args, **options):
        project = options["project"] or default_project_name()
        dry_run = options["dry_run"]
        project_dir = resolve_project_dir(project)

        engine = Engine(dirs=[str(TEMPLATE_DIR)], autoescape=False)
        documented = engine.get_template("urls_api_documented.py-tpl").render(
            Context({"project": project}, autoescape=False)
        )

        self.scaffold(
            project_dir / "urls_api_generated.py", GENERATED_URLS_STUB, dry_run
        )
        self.scaffold(project_dir / "urls_api_documented.py", documented, dry_run)
