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
        "name": "Input and Target Selection",
        "description": "A configured input selects an interaction and resolves its target in the scene."
      },
      {
        "name": "Entity Resolution",
        "description": "The world bridge converts actor and target nodes into runtime entity IDs."
      },
      {
        "name": "Definition Lookup",
        "description": "The runtime resolves the interaction and its referenced action."
      },
      {
        "name": "Availability and Requirements",
        "description": "The interaction executor checks the actor's available interactions and evaluates authored requirements."
      },
      {
        "name": "Sequential Effect Execution",
        "description": "The action executor binds entity roles and arguments, then applies each effect through the attribute connector."
      },
      {
        "name": "State Updates and Feedback",
        "description": "Successful writes update entity state and emit attribute notifications. Displays refresh, and execution returns a structured result."
      }
    ],
    "stores": [],
    "architectureVertical": true,
    "architectureCaption": "Framework responsibilities and the path from player input to entity updates and interface feedback.",
    "architectureGroups": [
      {
        "name": "Authored Content",
        "description": "Entity presets, reusable attribute fragments, interaction and action definitions, configuration, and presentation scenes."
      },
      {
        "name": "Runtime API",
        "description": "Interfaces for session startup, entity access, interactions, world bindings, and persistence."
      },
      {
        "name": "Runtime Implementation",
        "description": "Entity storage, attribute references, requirement evaluation, effect execution, clock state, and save encoding."
      },
      {
        "name": "Godot Environment",
        "description": "Session hosting, content discovery, map loading, scene bindings, input, targeting, movement, and interface presentation."
      }
    ],
    "architectureNote": "Runtime entities store gameplay attributes independently of scene nodes. The environment connects those entities to maps, controls, and displays. Interaction requirements are checked before action execution, while effects are applied sequentially and notify observers as individual writes succeed. Movement and clock advancement follow separate update paths.",
    "implementation": [
      {
        "title": "Reusable entity composition",
        "detail": "Entity presets combine reusable attribute fragments with explicit overrides. Each spawned entity receives its own copied data, allowing characters to share definitions while maintaining independent state. This supports different gameplay roles without requiring a separate entity class for each role."
      },
      {
        "title": "Runtime state separated from scenes",
        "detail": "The runtime owns entity attributes and interaction execution. Godot environment components bind those entities to scene nodes and provide input, movement, maps, and presentation. Stable entity keys connect saved state to scene placements when a session is reconstructed."
      },
      {
        "title": "Declarative interactions and effects",
        "detail": "Interaction definitions specify availability, requirements, and arguments, while action definitions describe changes to entity attributes. Reusable executors bind the actor and target, check requirements, and apply effects in order. Execution stops at the first failure; earlier successful effects remain applied."
      },
      {
        "title": "Presentation driven by runtime changes",
        "detail": "Attribute displays read values through the runtime API and refresh when relevant attributes change. Entity bindings connect status displays to their scene representations, allowing interface components to present gameplay state without maintaining a separate copy."
      },
      {
        "title": "Versioned session reconstruction",
        "detail": "Session snapshots capture entity attributes, clock state, the active map, and entity positions. The save format includes version checks and a SHA-256 checksum for corruption detection. Loading reconstructs a stopped session from current content definitions and saved data, while saving writes through a temporary file before publishing the result."
      }
    ],
    "demoSteps": [
      { "text": "Download or clone the linked repository and use Godot 4.7.1 to run the project." },
      { "text": "For your first session, use the new-session setting and bootstrap command below." },
      { "text": "Move with WASD or the arrow keys. Press Space to strike the nearest target and watch its health display change." },
      { "text": "Press F5 to save. Close the game, switch to restore mode, and relaunch to restore entity state, time, the map, and positions." }
    ],
    "testing": [],
    "limitations": "",
    "improvement": "",
    "contribution": "I built the framework, Code-First authoring tools, reusable gameplay systems, test suites, and browser/AWS portfolio integration using Godot.",
    "engineeringFocus": "Reusing game systems while checking actions and saved progress.",
    "recommendedDemoUrl": "/demos/crpg-game/?game=code-first-feature-demo"
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
