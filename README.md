# arches-zod-validation
[![Project Status: WIP – Initial development is in progress.](https://www.repostatus.org/badges/latest/wip.svg)](https://www.repostatus.org/#wip)

A TypeScript validation library that provides generic Zod schemas aligned with the data structures returned by Arches QuerySets, plus a Django code-generation pipeline that produces them from your project's resource graphs.

## Overview

`arches-zod-validation` bridges the gap between the dynamic JSON structures produced by Arches graph queries and the type safety expected in modern TypeScript applications.

The library provides a collection of composable Zod schemas that model the generic patterns found in Arches graph data, and a management-command pipeline that generates, per resource graph: read-only DRF views, an OpenAPI spec, and a Zod client — making the graph definitions the single source of truth from database to frontend.

## Features

- Generic schemas for common Arches QuerySet response structures
- Runtime validation using Zod
- Automatic TypeScript type inference
- Composable building blocks for custom graph schemas
- Generation of Zod schemas from Arches Resource models to provide a single source of truth

## Requirements

In the consuming Django project:

- `arches_zod_validation` and `drf_spectacular` in `INSTALLED_APPS`. drf-spectacular is load-bearing even outside schema generation: the generated views import `extend_schema` at module load, so any process that imports the URLconf needs it.
- `REST_FRAMEWORK["DEFAULT_SCHEMA_CLASS"] = "drf_spectacular.openapi.AutoSchema"` in settings. Without it the `spectacular` command runs but introspects views with DRF's legacy generator and produces a near-empty spec.
- `@hey-api/openapi-ts` in the project's `package.json` devDependencies (the pipeline invokes the project's pinned copy directly; no npm script entry is required).

## The generation pipeline

Three steps, one entry point:

```
python manage.py regenerate_api
```

1. **`generate_graph_views`** — queries the project's resource graphs (excluding `arches_system_settings` and any graph with a `source_identifier`) and renders, per graph, a module containing a serializer pinned to the graph slug plus owner-scoped, read-only List and Retrieve views. Also renders `urls_api_generated.py` routing them, and scaffolds a default `openapi-ts.config.ts` at the repo root **only if missing** — that file is hand-tuned and is never overwritten.
2. **`spectacular`** — generates `schema.yml` from the dedicated urlconf `<project>.urls_api_documented`. Run in a **fresh subprocess** on purpose: Django's startup system checks import the URLconf, so the orchestrating process may hold the previous generation of the modules in `sys.modules`; a fresh interpreter is guaranteed to document the views just written.
3. **`openapi-ts`** — generates the Zod client from `schema.yml` into `<project>/src/<project>/client`, using the binary from the project's `node_modules/.bin/` (lockfile-pinned), falling back to `npx --no-install openapi-ts`.

Any step failing aborts the pipeline, so artifacts can never get out of sync with each other.

### Generated layout (in the project, e.g. `bcrhp`)

```
<repo root>/
    openapi-ts.config.ts            scaffolded once; yours to edit
    schema.yml                      generated (step 2)
    bcrhp/
        urls.py                     yours; includes urls_api_generated (see below)
        urls_api_documented.py      yours; the urlconf spectacular documents
        urls_api_generated.py       generated (step 1)
        views/
            generated/              generated (step 1); fully owned by the pipeline
        src/bcrhp/client/           generated (step 3)
```

### Command reference

`python manage.py regenerate_api [options]`

| Option | Purpose |
| --- | --- |
| `--project NAME` | Project package (default: auto-detected from `settings.APP_NAME`, falling back to the settings module path). |
| `--urlconf DOTTED` | Urlconf for spectacular (default: `<project>.urls_api_documented`). |
| `--schema-file FILE` | OpenAPI spec path (default: `schema.yml`). |
| `--strict` | Pass `--validate --fail-on-warn` to spectacular. Off by default; enable once the schema is warning-clean, then keep it on — schema warnings are places where the Zod output is guessing. |
| `--skip-views` | Reuse the committed generated views (graphs unchanged). |
| `--skip-zod` | Backend-only environments without Node. |
| `--zod-cmd "CMD"` | Override the openapi-ts invocation. |
| `--check` | After regenerating, fail if any pipeline-owned artifact differs from the git index. |

`generate_graph_views` can also be run standalone; see `--help` for its `--url-prefix`, `--dry-run`, and `--overwrite` options. Note that `regenerate_api` always regenerates views with `--overwrite` — pipeline runs must be deterministic.

### URL wiring

The generated routes live in `urls_api_generated.py`; include them from the project's `urls.py`. Because the generated file is committed (see below), the recommended pattern is to commit an initial stub containing `urlpatterns = []` before first generation, keeping `urls.py` a plain unconditional `include()` with no existence guards.

`urls_api_documented.py` is a hand-written urlconf containing only the routes that belong in the public OpenAPI spec — typically just an `include()` of `urls_api_generated` plus any hand-written documented endpoints. The naming keeps the three files adjacent in the filesystem: `urls.py`, `urls_api_documented.py`, `urls_api_generated.py`.

### Workflow and commit policy

Steps 1–2 depend on **database state** (the graph definitions), not just source code, so CI generally cannot regenerate from scratch. All pipeline outputs are therefore **committed artifacts**, regenerated locally whenever graphs change — the same category of workflow as `makemigrations`, and not something to run in deploy scripts.

After changing a graph:

```
python manage.py regenerate_api
git add schema.yml bcrhp/views/generated bcrhp/urls_api_generated.py bcrhp/src/bcrhp/client
git commit
```

In CI, verify internal consistency of what's committed (no graph data needed):

```
python manage.py regenerate_api --skip-views --check
```

This reruns steps 2–3 against the committed views and fails on drift, catching the "edited the views or graphs but forgot to regenerate" class of error. If your CI does load the graphs, drop `--skip-views` for full coverage.

## Troubleshooting

**Management commands disappear from `manage.py --help`, or `import arches_zod_validation` shows `__file__ == None`.** A stray `arches_zod_validation/` directory (no `__init__.py`) in the project root is shadowing the real app as a PEP 420 namespace package. Remove it. Current versions of the generator resolve output paths by importing the target package and refuse to write into namespace packages, so this cannot recur from the pipeline itself.

**`CommandError: ... would shadow it` mentioning `views.py`.** The project has a legacy `bcrhp/views.py` module; creating `bcrhp/views/` beside it would shadow the module (packages win) and break existing imports. Convert `views.py` into a `views/` package first.

**`Unknown command: 'spectacular'`.** `drf_spectacular` is missing from `INSTALLED_APPS` in the settings the process resolved (Django builds its command registry from `INSTALLED_APPS`). See Requirements. The app ships a system check that reports this explicitly at startup.

**`spectacular failed (exit 1)` with `--strict`.** Warnings were promoted to failures; the warning text is printed above the error. Fix with `@extend_schema` annotations or type hints on the offending views/mixins, or drop `--strict` until ready.

**Zod output differs between machines.** Ensure openapi-ts resolves from the project's `node_modules` (run `npm ci`); the pipeline deliberately refuses to let `npx` fetch an unpinned version.

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).

The AGPL ensures that modifications to this software remain available to the community, including when the software is used to provide network services. If you distribute this software, or make modified versions available over a network, you must also make the corresponding source code available under the same license.

For the full license text, see the LICENSE file in this repository or visit:
https://www.gnu.org/licenses/agpl-3.0.en.html
