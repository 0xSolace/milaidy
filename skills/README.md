# Skills

Runtime skills cache directory. The agent writes `skills/.cache/catalog.json` here when fetching the skills marketplace catalog.

Shipped skills live in `scripts/skills/` and are seeded to the user's state directory (`~/.milady/skills/`) by `scripts/ensure-skills.mjs` at startup.
