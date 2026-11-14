import type { Project } from '../types/project';

export const projects: Project[] = [
  {
    "slug": "commerce-ordering-platform",
    "name": "Product Ordering Platform",
    "description": "A sample ordering application for creating, viewing, and cancelling orders in a shared workspace.",
    "overview": "Each order retains the product names, quantities, and prices recorded at submission. Later catalog changes leave that order history intact.",
    "technologies": [
      "React",
      "Python",
      "API Gateway",
      "Lambda",
      "DynamoDB",
      "CloudFront"
    ],
    "demoUrl": "/demos/commerce-ordering-platform/index.html",
    "demoKind": "commerce",
    "status": "Deployed on AWS",
    "summaryFlow": [
      "Validate request",
      "Persist order",
      "Replay safely"
    ],
    "features": [
      "Submit and inspect sample orders",
      "Replay a request without duplicate orders",
      "Cancel confirmed orders",
      "Read prices from the shared product catalog"
    ],
    "architecture": [
      {
        "name": "React frontend",
        "description": "Product selection, order form, and shared public history"
      },
      {
        "name": "CloudFront",
        "description": "HTTPS delivery and same-origin /api/* routing"
      },
      {
        "name": "Commerce API Gateway",
        "description": "HTTP routes and request boundary"
      },
      {
        "name": "Python Lambda",
        "description": "Validation, order services, and persistence"
      }
    ],
    "stores": [
      {
        "name": "Shared CatalogTable",
        "description": "Published products and authoritative USD prices"
      },
      {
        "name": "Commerce order table",
        "description": "Order snapshots, request markers, and public-day history"
      }
    ],
    "architectureNote": "New orders condition-check the shared catalog in the same DynamoDB transaction that writes the order and its idempotency marker. Stored orders retain their original product names and prices.",
    "implementation": [
      {
        "title": "Server-owned validation and pricing",
        "detail": "The Python backend normalizes SKUs, quantities and example.com/org/net sample addresses, then resolves published products and Decimal prices from the shared catalog. Revision and active-generation checks reject stale catalog intent; the browser never supplies authoritative totals."
      },
      {
        "title": "Transactional order and retry records",
        "detail": "An order and its request marker commit in one DynamoDB transaction with catalog conditions. The original UUID, normalized payload and public-day context identify a retry: matching intent returns the persisted result, changed intent conflicts, and yesterday’s request cannot renew today. Explicit retries and conditional cancellation preserve the current stored status, including CANCELLED."
      },
      {
        "title": "Historical order snapshots",
        "detail": "Stored item names, quantities, prices and totals survive later catalog edits and nightly product resets. Bounded public-day queries use the existing history index; direct responses bridge eventual index lag. The API hides expired records immediately while physical TTL cleanup remains asynchronous. Responses exclude ownership hashes and other visitors’ request keys."
      }
    ],
    "demoSteps": [
      { "text": "Choose products and quantities, then enter a sample email at example.com, example.org or example.net." },
      { "text": "Submit and inspect the result and shared history." },
      { "text": "Use Retry original request to replay the saved intent, or cancel a confirmed public order." }
    ],
    "testing": [
      {
        "title": "Local behavior checks",
        "detail": "React and Python tests exercise public sharing/cancellation, legacy-private isolation, sample-address validation, atomic retries, catalog conflicts, immutable snapshots, DST and exact-midnight expiry. Local tests also cover clock skew, suspended tabs, late responses and bounded read recovery."
      },
      {
        "title": "Production verification — October 26, 2026",
        "detail": "The public-orders backend and website are deployed. Independent read-only checks matched all 25 files on both domains, the actual Commerce ZIP and stack policies. Standalone/embedded catalog reads and successful empty public history passed. This release did not test live creation, cancellation, replay, populated cross-client visibility or actual per-order midnight expiration."
      }
    ],
    "limitations": "A public sample workspace with bounded history, no payments, fulfillment, inventory reservation or customer accounts. Use sample information only. Any visitor may cancel an eligible confirmed order; cancelled records remain until midnight expiry.",
    "improvement": "Further work could add operational dashboards and a reviewed reconciliation workflow for uncertain request outcomes. These are future improvements, not current capabilities.",
    "contribution": "I built the React interface, Python backend, persistence layer, automated tests, and AWS integration.",
    "engineeringFocus": "Keeping order totals consistent and preventing duplicate submissions."
  },
  {
    "slug": "file-system-simulator",
    "name": "File-System Simulator",
    "description": "A shared file and document workspace with a live view of application records.",
    "overview": "DynamoDB stores folder structure, document metadata, products, and orders. Document files are stored separately in S3. Database Explorer connects these stored records to actions taken in the portfolio’s applications.",
    "technologies": [
      "React",
      "Python",
      "API Gateway",
      "Lambda",
      "DynamoDB",
      "S3",
      "Cognito"
    ],
    "demoUrl": "/demos/file-system-simulator/index.html",
    "demoKind": "filesystem",
    "status": "Deployed on AWS",
    "summaryFlow": [
      "Browse hierarchy",
      "Read documents",
      "Search metadata"
    ],
    "features": [
      "Inspect public order snapshots in a read-only Database Explorer",
      "Browse products and the existing virtual hierarchy",
      "Use separate shared folder, document and product editing tools",
      "Search names and tags with protected administrator boundaries"
    ],
    "architecture": [
      {
        "name": "React frontend",
        "description": "Read-only Database Explorer plus separate file, document, search and catalog management tools"
      },
      {
        "name": "CloudFront",
        "description": "HTTPS and existing same-origin Commerce, filesystem and catalog API routing"
      },
      {
        "name": "File-System / Catalog API Gateway",
        "description": "Published reads, allowlisted visitor management and protected administrator routes"
      },
      {
        "name": "Python Lambda services",
        "description": "Separate published-read, shared-content and administrator roles"
      }
    ],
    "stores": [
      {
        "name": "FileSystemTable",
        "description": "Hierarchy, document metadata, and index references"
      },
      {
        "name": "Shared CatalogTable",
        "description": "Products, canonical tags, relationships, and index references"
      },
      {
        "name": "Private document S3 bucket",
        "description": "Immutable, versioned Markdown, text, and PDF contents"
      }
    ],
    "architectureNote": "Published reads, enabled anonymous shared-content routes, and JWT-protected administrator routes use distinct authority and scoped execution roles. Cognito sign-in uses PKCE and TOTP; administrator Lambda checks also verify claims and CatalogAdmins membership. AWS, user, reset and recovery administration remains restricted. Database Explorer adapts existing application DTOs through GET-only reads, not raw DynamoDB access. Public Orders use the Commerce API independently of content capability loading. Only the visible collection and selected direct record refresh; product paging and folder reads stay bounded. The history index can lag; direct order detail preserves current status.",
    "implementation": [
      {
        "title": "Bounded read-only application views",
        "detail": "A GET-only adapter reuses the existing public-day and bounded-read helpers for recent public orders. Server-relative monotonic expiry, explicit generations and direct record reads keep stale index projections from reviving expired or cancelled orders. Products and lazy folder reads use the existing paced content client and verified scope. A single refresh cycle pauses when hidden; retained embedded previews use a versioned same-origin visibility handshake."
      },
      {
        "title": "Metadata versus document storage",
        "detail": "DynamoDB stores the hierarchy, revisions, tags and index references; a private versioned S3 bucket holds immutable Markdown, text and passive PDFs. Staged content becomes readable only after metadata commits. Raw HTML, active formats and oversized bodies are rejected."
      },
      {
        "title": "Revision-guarded edits",
        "detail": "Canonical metadata, uniqueness reservations, relationships and index updates commit together under an optimistic workspace revision. Stale edits and invalid moves are rejected. The protected root, cycle/depth limits and bounded subtree operations preserve hierarchy invariants; soft deletion retains tombstones and earlier object versions."
      },
      {
        "title": "Metadata indexing",
        "detail": "Transactional postings index normalized names, SKU metadata and bounded product-description terms. Tags support ANY/ALL filters, deterministic sorting and version-bound pagination. Document bodies and PDF text are not indexed; bounded searches explicitly report incomplete candidate sets."
      },
      {
        "title": "Content permissions versus administrator identity",
        "detail": "The browser uses verified server capabilities to select allowlisted shared routes, including draft content. Loading/unavailable configuration never grants write access. Separate administrator routes require JWT/catalog-write scope and independent issuer, client, expiry, token-use and group checks. Signing in uses S256 PKCE and required TOTP; access tokens remain in memory."
      }
    ],
    "demoSteps": [
      {
        "text": "Open the Ordering demo and create a sample order.",
        "linkedProjectSlug": "commerce-ordering-platform"
      },
      { "text": "Return to Database Explorer → Orders and select your order to inspect its saved details." },
      { "text": "Cancel the order in the Ordering demo, then return here to observe its updated status." }
    ],
    "testing": [
      {
        "title": "Database Explorer — local verification",
        "detail": "Controlled clocks, deferred requests and disposable Moto-backed services verify bounded refresh, expiry/visibility cleanup, scope loss, index lag, cancellation and read-only authority. Database Explorer publication and read-only production verification completed October 27, 2026. Populated cross-client order creation, cancellation, replay and actual per-order midnight acceptance remain local evidence, unperformed in production."
      },
      {
        "title": "Local behavior checks",
        "detail": "Tests cover hierarchy and publication invariants, revision conflicts, coordinated safe reads, capability gating, lazy destination loading, metadata/tag indexing, immutable body staging and administrator denial. Failed reads remain distinct from empty content; mutations are dispatched once per explicit action."
      },
      {
        "title": "Production verification — October 26, 2026",
        "detail": "Shared management is enabled with 64 API routes, including 25 JWT/catalog-write administrator routes. Completed website verification preserved private versioned storage, routing, runtime packages and enabled reset settings. The reliability release also captured a finite 37-GET all-200 sample; it does not guarantee future availability or complete administrator-workflow coverage."
      }
    ],
    "limitations": "Bounded shared demo storage: 40 retained nodes, 40 products and 30 tags. Search covers metadata/tags, not document-body full text. Tombstones and immutable object versions consume retained storage. Nightly product reset does not restore documents or folders; ordinary sample content is not permanently protected. Database Explorer shows up to 20 recent public orders, bounded product pages and one current folder. It is not a complete table scan, pushed update stream or full-text document search. Only sample data belongs in the shared workspace.",
    "improvement": "Potential improvements include an operator-facing reconciliation tool and broader indexing with a separately designed extraction pipeline. Neither is part of the current public application.",
    "contribution": "I built the explorer, document and catalog interfaces, Python services, metadata indexes, revision checks, automated tests, and AWS storage/authentication integration.",
    "engineeringFocus": "Connecting live application records with shared files and searchable documents.",
    "recommendedDemoUrl": "/demos/file-system-simulator/database"
  },
  {
    "slug": "crpg-framework",
    "name": "CRPG Framework",
    "demoKind": "crpg",
    "status": "Deployed on AWS",
    "description": "A reusable role-playing game framework demonstrated through five playable examples.",
    "overview": "The examples share systems for exploration, dialogue, inventory, combat, and saved progress. The guided showcase brings these systems together in ten interactive stations.",
    "technologies": [
      "Godot 4.7.1",
      "GDScript",
      "WebAssembly",
      "WebGL 2",
      "Strategy Pattern"
    ],
    "demoUrl": "/demos/crpg-game/",
    "summaryFlow": [
      "Request action",
      "Validate effects",
      "Update state"
    ],
    "features": [
      "Five games, including the ten-station Code-First Feature Demo",
      "Exploration, artwork, contextual actions, and conditional dialogue",
      "Turn-based combat with several characters and different resource types.",
      "Authored Inventory, Talents, Quest Journal, Reputation, and reference windows",
      "Move items between characters and containers."
    ],
    "architecture": [
      {
        "name": "Action Request",
        "description": "Action ID, actor, target, and arguments from the interface"
      },
      {
        "name": "Action Dispatcher",
        "description": "Resolve entities and check request and session constraints"
      },
      {
        "name": "Strategy Registry",
        "description": "Resolve the registered behavior for the action ID"
      },
      {
        "name": "Selected Strategy",
        "description": "Registered behavior selected; execution waits for eligibility checks"
      },
      {
        "name": "Condition Evaluation",
        "description": "Authored conditions and strategy-specific eligibility checks precede execution"
      },
      {
        "name": "Proposed Effects",
        "description": "Strategy execution constructs explicit state changes, messages, and events"
      },
      {
        "name": "Effect Validation",
        "description": "Apply effects to shadow state and check owner and session invariants"
      },
      {
        "name": "State Commit",
        "description": "Apply normalized primitive effects to authoritative owners"
      },
      {
        "name": "Post-Commit Events",
        "description": "Ordered notifications after the action effects commit"
      },
      {
        "name": "Action Result / UI",
        "description": "Render the result and refreshed runtime state"
      }
    ],
    "stores": [],
    "architectureVertical": true,
    "architectureCaption": "Framework components and the sequence of a gameplay action.",
    "architectureGroups": [
      {
        "name": "Core",
        "description": "Action contracts, state references, shared types"
      },
      {
        "name": "Entity",
        "description": "Generic Entity, Entity Blueprint, Entity Registry"
      },
      {
        "name": "Runtime",
        "description": "GameRuntime, WorldState, SystemState, SessionStore, Action Dispatcher, Strategy Registry"
      },
      {
        "name": "Gameplay",
        "description": "Exploration, dialogue, combat, interactions"
      },
      {
        "name": "Infrastructure",
        "description": "Conditions, effects, events, persistence"
      },
      {
        "name": "Integration",
        "description": "World View, Dialogue View, Combat View, UI components"
      }
    ],
    "architectureNote": "The diagram groups the execution responsibilities. Authored conditions are checked by the dispatcher before strategy execution; strategies also validate their own requirements. Effects are checked on shadow state before commit. This does not promise rollback if a live commit is interrupted. The UI reads state and submits actions rather than directly editing gameplay owners.",
    "implementation": [
      {
        "title": "Authoring and runtime separation",
        "detail": "GDScript Code-First definitions generate validated content for the existing loader. Generic Entities hold developer-defined typed attributes and containers, avoiding a class per gameplay role. Five games share the same runtime rather than embedding game-specific rules in interface widgets."
      },
      {
        "title": "Validated actions",
        "detail": "The Action Dispatcher resolves registered strategies, validates requests and conditions, then validates proposed effects on shadow state before committing to authoritative owners. The UI projects state and submits actions. Ordered events follow commit; interruption during a live commit is not promised to roll back."
      },
      {
        "title": "Registered extensions",
        "detail": "Trusted extensions install before initialization and use the existing dispatcher, validation and state owners. Authored windows expose Inventory, Talents, Quests, Reputation and container transfer; they do not introduce a separate gameplay engine. Feature Guide, Wait and Resolve opponent turn make the guided stations observable."
      },
      {
        "title": "Validated save restoration",
        "detail": "SaveManager v2 validates candidate entity, world, system and session state before replacing the running game. Each example retains its own slot and existing schema. Saves use browser-origin-local IndexedDB; there is no gameplay server or cloud save synchronization."
      }
    ],
    "demoSteps": [
      { "text": "Start the guided showcase, then open Menus → Feature Guide for the ten stations." },
      { "text": "Try a contextual action, dialogue choice, container transfer or supported combat encounter." },
      { "text": "Use the saving guidance below to save and load the matching game; other examples remain available." }
    ],
    "testing": [
      {
        "title": "Framework validation — October 25, 2026",
        "detail": "The retained local Full suite passed 3,742 registered assertions. Another 389 supplemental checks brought that release’s total to 4,131, including 303 mechanics/persistence and 43 real-input UI assertions. Export inspection covered all five startups, canonical content, artwork and font licensing. These dated suites were not rerun for this presentation revision."
      },
      {
        "title": "Production acceptance — October 25, 2026",
        "detail": "Release fb4444f7f8c910fd6b84 was published and independently verified. Recorded desktop checks exercised all ten Feature Demo stations and representative behavior in all five examples; narrow desktop-pointer checks included reload/Load, transfer and movement. The original iframe retained its game through collapse/reopen. Physical touch, other browsers and exhaustive workflow coverage were not established. Later October 26 publication checks preserved its bytes; hashes alone are not gameplay acceptance."
      },
      {
        "title": "Portfolio integration",
        "detail": "Local portfolio tests check opt-in mounting, trusted child messages, retained iframe identity, keyboard/hash navigation and the recommended launch. Package checks preserve all eight raw and twelve staged game files, selectors and save paths without regenerating Godot."
      }
    ],
    "limitations": "Requires a WebAssembly and WebGL 2 capable browser. The single-threaded export is a substantial download and desktop keyboard and mouse remain the primary controls. Browser storage can be evicted; a different hostname has a different save store. No multiplayer, cloud saves, or complete narrative campaign is claimed.",
    "improvement": "Future work could improve touch ergonomics, add a user-facing save export, and expand authored content. These are proposed improvements, not implemented features.",
    "contribution": "I built the framework, Code-First authoring tools, reusable gameplay systems, test suites, and browser/AWS portfolio integration using Godot.",
    "engineeringFocus": "Reusing game systems while checking actions and saved progress.",
    "recommendedDemoUrl": "/demos/crpg-game/?game=code-first-feature-demo",
    "historicalVerification": [
      {
        "date": "2026-10-23",
        "title": "Earlier four-game Code-First export",
        "detail": "2,450 automated checks passed with zero failures in the Godot 4.7.1 local export pipeline. The then-shipping definitions, four startups, 20 JSON roots, nine images and licensed font were inspected. This historical framework/export record is not a new production gameplay check."
      },
      {
        "date": "2026-10-22",
        "title": "v1.4 framework and window-header checks",
        "detail": "591 automated checks passed: 534 existing assertions plus 57 Window Header Refinement assertions. V1_4_WINDOW_HEADER_AFTER_ACTION_REPORT.md and build/v14-header-validation/final-tests.log retain that local record, alongside 16 HTTP checks and native/Chromium observations. These are historical checks, not reruns or current production acceptance."
      }
    ]
  }
];

export const skills = [
  {
    "title": "Web interfaces",
    "summary": "React, TypeScript and JavaScript.",
    "detail": "React, TypeScript and JavaScript; accessible navigation, explicit form state and asynchronous error/recovery feedback."
  },
  {
    "title": "Application and game systems",
    "summary": "Python and Godot/GDScript.",
    "detail": "Python application services and repositories; Godot/GDScript, Generic Entity data, registered strategies and validated save restoration."
  },
  {
    "title": "Cloud and delivery",
    "summary": "AWS and infrastructure as code.",
    "detail": "AWS CloudFront, S3, API Gateway, Lambda, DynamoDB, Cognito and IAM; CDK/CloudFormation, Terraform and Amazon Route 53."
  },
  {
    "title": "Reliability and testing",
    "summary": "Validation, transactions, revisions and automated checks.",
    "detail": "Domain validation, authoritative pricing, persistence, idempotency, revision guards, metadata indexing, Vitest/Testing Library and pytest."
  }
];
