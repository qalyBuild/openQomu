# Architecture

[Español](architecture.es.md)

## Overview

openQomu is a single-page React application that talks to a backend through ports. The domain knows nothing about React, Firebase or Capacitor, so the same product runs against Firestore, against an in-browser demo store, or against a future backend adapter.

```
presentation ──▶ app (container) ──▶ domain ports ──▶ infrastructure adapters
      │                                                   │
      └────────────── React state, hooks ─────────────────┘
```

## Layers

| Path | Responsibility |
| --- | --- |
| `src/domain` | Entities, pure services, validation, permission rules, port interfaces. No framework imports. |
| `src/app` | Dependency composition (`createContainer`), providers, routing and workspace bootstrap. |
| `src/infrastructure` | Adapters: `firebase`, `demo`, `capacitor`, `push`. |
| `src/presentation` | Pages, feature components, UI primitives and hooks. |
| `src/lib` | Small framework-agnostic helpers: dates, URLs, class names. |
| `src/config` | Deployment-level configuration (`PRODUCT_NAME`, `PRODUCT_SLUG`). |

## Ports and adapters

`src/domain/ports` declares one interface per aggregate: workspaces, members, channels, messages, boards, tasks, pages, files, folders, MCP tokens, devices and the push outbox. Two adapters implement them today:

- **demo**: in-memory store persisted in `localStorage`, files in `IndexedDB`. Selected automatically when Firebase credentials are missing.
- **firebase**: Firestore collections, Firebase Auth and optional Storage. Selected when the six `VITE_FIREBASE_*` variables are present.

`src/app/container.ts` imports the adapter lazily, so the demo bundle never downloads the Firebase SDK and vice versa.

Adding a backend means implementing the ports; no domain or presentation code changes are required. See [roadmap.md](roadmap.md).

## Data model

| Entity | Key | Notes |
| --- | --- | --- |
| Workspace | `workspaces/{workspaceId}` | Slug plus random suffix, immutable. |
| Member | `workspaces/{id}/members/{uid}` | Role: `owner`, `admin` or `member`. |
| Channel | `workspaces/{id}/channels/{channelId}` | Public or private with `memberIds`. |
| Message | `.../channels/{id}/messages/{messageId}` | Body, attachments, reactions, reply, `deletedAt`. |
| Board / Column | `.../boards/{id}` | Columns with WIP limits and colors. |
| Task | `.../boards/{id}/tasks/{taskId}` | Priority, labels, dependencies, assignees, reviewer. |
| Page | `.../pages/{pageId}` | Rich text JSON document. |
| File | `.../files/{fileId}` | Metadata in Firestore, binary per storage backend. |
| Folder | `.../fileFolders/{folderId}` | Tree structure for the file library. |
| MCP token | `.../mcpTokens/{tokenId}` | Hash plus scopes; the secret is shown once. |
| Device | `.../devices/{deviceId}` | FCM token per installation. |
| Push outbox | `.../pushOutbox/{eventId}` | Queue processed by the push Worker. |

Deletion is soft for messages: `deletedAt` marks the tombstone, the interface shows it for one hour and `push-worker` deletes the document afterwards. Files have a trash state before permanent deletion. Completed tasks keep `completedAt`; after 15 days `push-worker` deletes the task, its comments and its attachments, and clears dependency references. Dashboard completion metrics therefore describe the current board and the last 15 days.

## Runtime flow

1. `main.tsx` mounts providers: theme, auth, workspaces.
2. `createContainer()` picks the adapter from the build-time environment.
3. Providers subscribe to workspace, channel and board streams and expose them through hooks.
4. Mutations go through repository methods that validate with domain services first.
5. Push notifications are written to the outbox; the push Worker delivers them to FCM.

## Real-time behaviour

Firestore `onSnapshot` listeners provide chat, boards and typing state. Presence is derived from `lastActiveAt`. Everything degrades gracefully in demo mode, where the store notifies subscribers synchronously.

## Security boundary

The client is untrusted. `firestore.rules` and `storage.rules` enforce membership, roles, field immutability and size limits. See [security.md](security.md).

## Decisions

Architecture decision records live in [adr/](adr/).
