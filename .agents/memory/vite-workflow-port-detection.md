---
name: Vite workflow port detection
description: Port conflicts between manual configureWorkflow and artifact workflows for Vite dev servers
---

## Rule
Never create a manual `configureWorkflow` for a Vite dev server that uses the same port as an existing artifact workflow. The artifact system auto-starts its own workflow on the `localPort` defined in artifact.toml — a duplicate manual workflow causes "Port X is already in use" and the artifact workflow fails.

**Why:** When a Replit environment restarts, ALL configured workflows auto-start simultaneously. If both a manual workflow (`configureWorkflow`) and an artifact's own workflow (`artifacts/<name>: <service>`) target the same port, one will win and the other will crash with "port already in use." The artifact workflow shows as "failed" in the UI, which looks broken to users.

**How to apply:**
- For Vite dev servers, rely exclusively on the artifact's built-in workflow (`artifacts/<name>: web`) — do NOT create a parallel `configureWorkflow` for the same command/port.
- Artifact Vite workflows (kind="web", kind="design") DO work correctly when there is no port conflict. The mockup-sandbox on port 8081 is evidence of this.
- If you created a manual workflow as a workaround and now need to fix the artifact workflow: remove the manual workflow first, then restart the artifact workflow.

## Recovery steps
1. `removeWorkflow({ name: "conflicting-workflow-name" })`
2. `restart_workflow("artifacts/<name>: web")`
