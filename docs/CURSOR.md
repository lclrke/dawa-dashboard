# DAWA Dashboard — Docs Index

Quick reference for which doc to read:

| Working on... | Read |
|---------------|------|
| Overall architecture, assistant flows, security model | `dawa-dashboard-project-overview.md` |
| Database tables, JSONB schemas, RLS, queries | `supabase-schema.md` |
| MusicGen training: inputs, polling, datasets | `replicate-training.md` |

## Key Facts (Always True)

- `parse_id` is opaque — never parse it
- `master_schema` is shared across all assistants
- Privileged ops (storage writes, Replicate calls) are server-side only
- Dashboard does NOT parse `.als` files — that's `dawa-portable`
- Dataset ZIPs need public HTTPS URLs for Replicate
