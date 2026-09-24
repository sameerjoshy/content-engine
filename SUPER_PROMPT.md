# SUPER_PROMPT: Content Engine Tool - Complete System Specification

**Version:** 1.0  
**Date:** 2026-08-27  
**Audience:** Developers building the Content Engine tool  
**Status:** Ready for implementation (Phase 1 MVP)

---

## Table of Contents

1. [Vision & Problem Statement](#vision--problem-statement)
2. [Phase 1 Scope (MVP)](#phase-1-scope-mvp)
3. [System Architecture](#system-architecture)
4. [User Flow & UX](#user-flow--ux)
5. [API Specification](#api-specification)
6. [Database Schema](#database-schema)
7. [Agent Specifications](#agent-specifications)
8. [Implementation Roadmap](#implementation-roadmap)
9. [Success Criteria](#success-criteria)
10. [Deployment & DevOps](#deployment--devops)

---

## Vision & Problem Statement

### The Problem

Most content workflows are black boxes. Creators don't see why output is generic, can't iterate easily on inputs, and don't understand which inputs actually matter.

### The Solution

A tool that runs content creation in <10 minutes with **transparency at every stage**:
1. User picks a profile (brand voice, ICP, research rules)
2. User enters: topic, angle, depth
3. System runs: research → write → edit (visible progress)
4. User sees: draft at each stage and can understand *why* it looks that way
5. User iterates: change 1 input, run again, see impact immediately

### Why It Matters

- **Transparency** → Users understand what inputs drive output quality
- **Speed** → <10 minutes from input to publishable draft
- **Iteration** → Change one thing, run again, see the difference
- **Learning** → Each run teaches users what their brand needs

---

## Phase 1 Scope (MVP)

### What's In Phase 1

**Five agents** that run sequentially:
1. **Angle Validator** → Is this angle distinct from existing content?
2. **Researcher** → Gather sources and create a dossier
3. **Spec Builder** → Translate profile into writer instructions
4. **Writer** → Create draft based on spec
5. **Editor** → One basic editor (fact-check, structure, tone)

**Five screens** in the frontend:
1. Profile Selection
2. Article Input (topic, angle, depth)
3. Workflow Monitor (real-time progress)
4. Draft Viewer (read output at each stage)
5. Publish Modal (publish to markdown)

**One database**: PostgreSQL with 4 tables (profiles, sessions, drafts, logs)

**Publish destination**: Markdown only (Phase 2 adds CMS, WordPress, Medium)

### What's NOT in Phase 1 (Phase 2+)

- Draft editing in the UI (read-only viewer)
- Parallel edits (sequential only)
- Human gates/pauses between stages
- Profile customization UI
- Mobile optimization
- Version comparison or A/B testing
- Multiple publish destinations

---

## System Architecture

### High-Level Architecture

```
Frontend (React)
    ↓ API calls (POST, GET)
Backend API (Node/Express OR Python/FastAPI)
    ↓ orchestrates
Orchestrator (manages 5 agents, runs stages)
    ↓ calls
LLM Agents (5 for MVP)
    ↓ reads/writes
PostgreSQL (profiles, sessions, drafts, logs)
```

### Component Breakdown

#### Frontend (React + TypeScript)
- **Input Manager**: Profile selector, topic/angle/depth form
- **Workflow Monitor**: Real-time progress display, polling backend
- **Draft Viewer**: Display draft markdown, stage selector
- **Publish Modal**: Destination selector, publish button

#### Backend (Node/Express OR Python/FastAPI)
- **API Routes**: `/run-article`, `/workflow-status`, `/draft`, `/publish`
- **Orchestrator**: Manages 5-stage flow, error handling, logging
- **Agent System**: Wraps LLM calls, prompts, output parsing
- **Database Manager**: Read/write profiles, sessions, drafts, logs

#### Database (PostgreSQL)
- **profiles table**: Stores YAML profiles as JSON
- **sessions table**: Tracks active article runs
- **drafts table**: Saves draft output at each stage
- **logs table**: Every event (LLM call, stage transition, error)

### Data Flow for One Article Run

```
1. User clicks "Run Article"
   → POST /run-article { profile_id, topic, angle, depth }
   → Backend creates session, returns sessionId

2. Frontend polls /workflow-status/:sessionId every 2 seconds

3. Backend orchestrator runs 5 stages sequentially:
   Stage 1: Angle Validator (LLM call 1)
             → save to drafts table
             → update session.current_stage
   
   Stage 2: Researcher (LLM call 2, async)
            → save to drafts table
            → update session
   
   Stage 3: Spec Builder (LLM call 3)
            → save to drafts table
            → update session
   
   Stage 4: Writer (LLM call 4, async)
            → save to drafts table
            → update session
   
   Stage 5: Editor (LLM call 5)
            → save to drafts table
            → mark session complete

4. User clicks "View Draft" → GET /draft/:sessionId/:stage
   → Returns markdown from drafts table

5. User clicks "Publish" → POST /publish/:sessionId
   → Write markdown file to disk/export
   → Return file download URL

6. All events logged to logs table (for debugging, cost tracking)
```

---

## User Flow & UX

### Screen 1: Profile Selection

**Purpose**: User picks a profile (brand voice, ICP, research rules)

**Layout**:
- Header: "Select Your Profile"
- Card grid (4 cards for MVP, 1 per profile):
  - Card title: Profile name (e.g., "Thought Leader")
  - Card subtitle: "SaaS marketing, technical audiences, deep research"
  - Card content: 2-3 lines describing the voice
  - Button: "Use This" (green, primary button)
- Card styling: Use DESIGN_SYSTEM_TOKENS.json (cards section)

**Microinteraction**:
- Hover over card: Slight shadow increase, subtle background change
- Click "Use This": Fade to next screen

**Data**: Load profiles from GET /profiles endpoint (returns list of profiles from backend)

---

### Screen 2: Article Input

**Purpose**: User enters topic, angle, depth

**Layout**:
- Header: "Create Your Article"
- Subheader: Show selected profile name
- Form:
  - Input 1: "Topic" (text input, required)
    - Placeholder: "e.g., AI in content workflows"
    - Validation: Show ✓ when >3 characters
  - Input 2: "Angle" (text input, required)
    - Placeholder: "e.g., Why most AI content pipelines fail"
    - Validation: Show ✓ when >5 characters
  - Radio group: "Research Depth"
    - Options: Light (1-2 hours research), Moderate (3-4 hours), Deep (6+ hours)
    - Default: Moderate
  - Button: "Run Article" (green, primary, disabled until inputs valid)

**Validation States**:
- Empty field: Gray input, no icon
- Valid field: Green input border, ✓ icon
- Submission: Show loading state on button

**Microinteraction**:
- As user types, check validation in real-time
- Show checkmarks incrementally
- Disable "Run Article" button until all 3 inputs valid

**Data**: POST /run-article with { profile_id, topic, angle, depth }

---

### Screen 3: Workflow Monitor

**Purpose**: Show real-time progress as article runs

**Layout**:
- Header: "Your Article is Being Created"
- Timeline (horizontal or vertical):
  ```
  1. Check Angle      ✓ (2 seconds)
     ↓
  2. Research         ⏳ (researching... 3/5 sources found)
     ↓
  3. Build Spec       ◯ (waiting)
     ↓
  4. Write Draft      ◯ (waiting)
     ↓
  5. Edit & Polish    ◯ (waiting)
  ```
  
  - Stage item layout:
    - Icon: ✓ (complete) | ⏳ (in progress) | ◯ (pending) | ✕ (error)
    - Stage name (e.g., "Check Angle")
    - Status text (e.g., "3/5 sources found" for Researcher stage)
    - Time elapsed for current stage
  
  - Current stage: Highlighted with background color
  - Completed stages: Green checkmark
  - Pending stages: Gray circle

**Status Updates**:
- Frontend polls /workflow-status/:sessionId every 2 seconds
- Returns { current_stage, stage_progress (0-100%), message, elapsed_time }
- Update UI without flickering

**Timing Expectations**:
- Angle Validator: 10-30 seconds
- Researcher: 2-4 minutes (async, can take time)
- Spec Builder: 30 seconds
- Writer: 1-2 minutes (async)
- Editor: 30-60 seconds
- **Total**: <10 minutes

**Actions**:
- No actions available (read-only during run)
- If error: Show error message and "Retry" button

---

### Screen 4: Draft Viewer

**Purpose**: Show draft output, allow stage switching

**Layout**:
- Header: "Your Draft"
- Subheader: Show article topic and angle
- Stage selector (dropdown):
  - Options: Research Dossier, Writer Spec, Draft, Edited Draft
  - Selected stage highlighted
- Markdown viewer:
  - Display draft content (markdown rendered as HTML)
  - Scrollable, readable layout
  - Use neutral background (light gray or white)
- Buttons:
  - "Publish" (green, primary) - bottom right
  - "Download" (secondary) - download as .md file
  - "Back" (tertiary) - go back to workflow

**Microinteraction**:
- Stage selector dropdown: Show which stage is "final"
- Markdown rendering: Use clean typography from DESIGN_SYSTEM_TOKENS.json
- Scroll-to-top on stage change

**Data**: GET /draft/:sessionId/:stage (returns markdown content)

---

### Screen 5: Publish Modal

**Purpose**: Confirm publish settings and export

**Modal Layout**:
- Header: "Publish Your Article"
- Form:
  - Destination selector (radio group):
    - Option 1: "Markdown File" (default)
    - Option 2: "Copy to Clipboard"
  - Optional: File name input (pre-filled with "article-[date].md")
- Buttons:
  - "Publish" (green, primary)
  - "Cancel" (secondary)

**Post-Publish**:
- Show success message: "✓ Article published successfully"
- Show file path or download link
- Button: "Create Another Article" (back to profile selection)

**Data**: POST /publish/:sessionId with { destination }

---

## API Specification

### Base URL
```
Backend: http://localhost:3000 (development)
         or deployed domain (production)
```

### Endpoints

#### 1. POST /run-article
**Purpose**: Start a new article run

**Request**:
```json
{
  "profile_id": "thought-leader",
  "topic": "AI in content workflows",
  "angle": "Why most AI content pipelines fail",
  "depth": "moderate"
}
```

**Response** (201 Created):
```json
{
  "session_id": "sess_abc123def456",
  "status": "starting",
  "created_at": "2026-08-27T14:30:00Z"
}
```

**Error** (400 Bad Request):
```json
{
  "error": "Invalid profile_id",
  "details": "Profile 'thought-leader' not found"
}
```

**Logic**:
- Validate profile_id exists
- Validate topic length >3 chars
- Validate angle length >5 chars
- Validate depth in ["light", "moderate", "deep"]
- Create row in sessions table
- Return session_id
- Backend immediately starts orchestrator for this session (async)

---

#### 2. GET /workflow-status/:sessionId
**Purpose**: Get real-time progress on article run

**Request**:
```
GET /workflow-status/sess_abc123def456
```

**Response** (200 OK):
```json
{
  "session_id": "sess_abc123def456",
  "current_stage": "researcher",
  "stage_progress": 60,
  "stage_message": "Found 3 sources, searching for 2 more",
  "elapsed_time": 120,
  "status": "in_progress",
  "error": null
}
```

**States**:
- status: "starting" | "in_progress" | "complete" | "error"
- current_stage: "validator" | "researcher" | "spec_builder" | "writer" | "editor" | "complete"
- stage_progress: 0-100 (percent complete for current stage)
- stage_message: Human-readable status (e.g., "Found 3/5 sources")

**Error Response** (404 Not Found):
```json
{
  "error": "Session not found",
  "session_id": "sess_abc123def456"
}
```

**Logic**:
- Fetch session from sessions table
- Return current_stage and progress
- Include human-readable message based on stage
- Update every 2 seconds (frontend polling)

---

#### 3. GET /draft/:sessionId/:stage
**Purpose**: Retrieve draft content at a specific stage

**Request**:
```
GET /draft/sess_abc123def456/researcher
```

**Stage Options**:
- `researcher` - Research dossier
- `spec_builder` - Writer specification
- `writer` - Full draft
- `editor` - Final edited draft

**Response** (200 OK):
```json
{
  "session_id": "sess_abc123def456",
  "stage": "writer",
  "content": "# Article Title\n\n## Section 1\n\nContent here...",
  "created_at": "2026-08-27T14:35:00Z"
}
```

**Error Response** (404 Not Found):
```json
{
  "error": "Draft not found for stage",
  "stage": "writer",
  "session_id": "sess_abc123def456"
}
```

**Logic**:
- Fetch draft from drafts table where session_id and stage match
- Return markdown content
- If stage hasn't been reached yet, return 404 with helpful message

---

#### 4. POST /publish/:sessionId
**Purpose**: Publish article to destination

**Request**:
```json
{
  "destination": "markdown",
  "filename": "my-article.md"
}
```

**Response** (200 OK):
```json
{
  "session_id": "sess_abc123def456",
  "published_at": "2026-08-27T14:36:00Z",
  "destination": "markdown",
  "file_path": "/exports/my-article.md",
  "file_url": "http://localhost:3000/exports/my-article.md"
}
```

**Error Response** (400 Bad Request):
```json
{
  "error": "Invalid destination",
  "details": "Only 'markdown' is supported in Phase 1"
}
```

**Logic**:
- Fetch final draft (editor stage) from drafts table
- Write to file or prepare for download
- Return file URL or download path
- Log publish event to logs table

---

#### 5. GET /profiles
**Purpose**: Fetch all available profiles

**Request**:
```
GET /profiles
```

**Response** (200 OK):
```json
{
  "profiles": [
    {
      "id": "thought-leader",
      "name": "Thought Leader",
      "description": "SaaS marketing, technical audiences, deep research",
      "icon": "📊"
    },
    {
      "id": "educator",
      "name": "Educator",
      "description": "Educational content, general audiences, accessible language",
      "icon": "📚"
    }
  ]
}
```

**Logic**:
- Return all profiles from profiles table
- Include id, name, description for UI display

---

### Error Handling

**All errors follow this format**:
```json
{
  "error": "[Error type]",
  "details": "[Human-readable explanation]",
  "request_id": "[For debugging]"
}
```

**HTTP Status Codes**:
- 400: Bad request (invalid input)
- 404: Not found (session/draft doesn't exist)
- 500: Server error (LLM failure, DB error)
- 503: Service unavailable (overloaded)

**Specific Error Cases**:
- LLM call fails: Return 500 with "LLM service error. Retrying..."
- Profile not found: Return 400 with "Profile [id] not found"
- Session expired: Return 410 with "Session expired. Start a new article."
- Database error: Return 500 with "Database error. Try again."

---

## Database Schema

### PostgreSQL Setup

```sql
-- Create database
CREATE DATABASE content_engine;

-- Create tables
CREATE TABLE profiles (
  id VARCHAR(50) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  brand_voice JSONB NOT NULL,
  icp JSONB NOT NULL,
  content_standards JSONB NOT NULL,
  research_rules JSONB NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE sessions (
  id VARCHAR(50) PRIMARY KEY,
  profile_id VARCHAR(50) NOT NULL REFERENCES profiles(id),
  topic VARCHAR(255) NOT NULL,
  angle VARCHAR(255) NOT NULL,
  depth VARCHAR(20) NOT NULL, -- light, moderate, deep
  current_stage VARCHAR(50) NOT NULL DEFAULT 'validator',
  status VARCHAR(50) NOT NULL DEFAULT 'starting', -- starting, in_progress, complete, error
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE drafts (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(50) NOT NULL REFERENCES sessions(id),
  stage VARCHAR(50) NOT NULL, -- validator, researcher, spec_builder, writer, editor
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, stage)
);

CREATE TABLE logs (
  id SERIAL PRIMARY KEY,
  session_id VARCHAR(50) REFERENCES sessions(id),
  event_type VARCHAR(50) NOT NULL, -- lmm_call, stage_start, stage_end, error
  stage VARCHAR(50),
  message TEXT,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_sessions_profile ON sessions(profile_id);
CREATE INDEX idx_sessions_status ON sessions(status);
CREATE INDEX idx_drafts_session ON drafts(session_id);
CREATE INDEX idx_logs_session ON logs(session_id);
CREATE INDEX idx_logs_created ON logs(created_at);
```

### Example Data

```sql
-- Insert a sample profile
INSERT INTO profiles (id, name, description, brand_voice, icp, content_standards, research_rules)
VALUES (
  'thought-leader',
  'Thought Leader',
  'SaaS marketing, technical audiences, deep research',
  '{...}' -- JSON from PROFILES.yaml
  '{...}',
  '{...}',
  '{...}'
);
```

---

## Agent Specifications

### Overview

Five agents run sequentially. Each agent:
1. Receives specific inputs
2. Runs LLM call with exact prompt
3. Outputs structured response
4. Response saved to drafts table
5. Next agent uses this output as input

### Agent 1: Angle Validator

**Purpose**: Determine if the angle is distinct from existing content. Gate before research to avoid wasted LLM costs.

**Input**:
- topic: string (e.g., "AI in content workflows")
- angle: string (e.g., "Why most AI content pipelines fail")
- existing_content: JSON array (from existing-content.json)
  - Each item: { title, angle, publish_date, profile }

**Instructions** (System Prompt):
```
You are an expert content strategist. Your job is to evaluate whether an article angle is distinct from existing published content.

TASK: Analyze if the proposed angle is NEW and VALUABLE compared to existing articles.

INPUT:
Topic: {topic}
Proposed Angle: {angle}

EXISTING CONTENT:
{existing_content_list}

ANALYSIS:
1. Identify the core claim/insight of the proposed angle
2. Compare to existing articles
3. Determine if it's truly novel OR if it's derivative

OUTPUT:
Return ONE of:
- PROCEED: This angle is distinct. Proceed to research.
- PIVOT: This angle overlaps with existing content. Suggest a different angle.
- KILL: This angle is too generic or similar. Don't write this.

If you recommend PIVOT or KILL, explain why and suggest a better angle.

Be strict. Don't green-light generic takes.
```

**Output Format**:
```json
{
  "decision": "PROCEED",
  "reasoning": "The angle focuses on execution gaps in pipelines, not just AI potential. This is novel.",
  "suggested_pivot": null,
  "confidence": 0.92
}
```

**Decision Logic**:
- PROCEED: Continue to Researcher stage
- PIVOT: Return suggestion to user (they can modify angle)
- KILL: Return "This angle won't work" (user must choose new topic)

**Error Handling**:
- If LLM fails: Return error, don't proceed
- If output invalid JSON: Retry (max 2 retries)

---

### Agent 2: Researcher

**Purpose**: Gather sources and build a research dossier. This dossier feeds into Spec Builder and Writer.

**Input**:
- topic: string
- angle: string
- depth: string (light, moderate, deep)
- research_rules: from profile (trusted sources, sources to avoid, depth requirements)

**Instructions** (System Prompt):
```
You are a research expert. Your job is to build a comprehensive dossier for a content article.

TASK: Research the topic and build a dossier that supports the proposed angle.

TOPIC: {topic}
ANGLE: {angle}
RESEARCH DEPTH: {depth}

RESEARCH RULES (from profile):
Trusted Sources: {trusted_sources}
Sources to Avoid: {sources_to_avoid}
Depth Requirements: {depth_requirements}

BUILD A DOSSIER CONTAINING:
1. Executive Summary (1 paragraph: what's the key insight?)
2. Key Claims (3-5 claims that support the angle)
3. Evidence (for each claim: 1-2 data points, sources, quotes)
4. Expert Quotes (2-3 relevant quotes)
5. Case Studies (1-2 examples that prove the angle)
6. Counter-arguments (what would someone disagree with?)
7. Sources Used (list all sources with URLs)

QUALITY GATES:
- All sources must be primary (no blog posts citing blog posts)
- All claims must be factual (no speculation)
- Evidence must be recent (<2 years old for tech)
- Quotes must be direct (not paraphrased)

OUTPUT: Well-structured markdown dossier. Include citations.
```

**Output Format**:
```markdown
# Research Dossier: [Topic]

## Executive Summary
[1 paragraph]

## Key Claims
1. [Claim 1]
   - Evidence: [data point 1]
   - Source: [URL]
   
## Case Studies
[2 detailed examples]

## Sources
- [Source 1]: [URL]
- [Source 2]: [URL]
```

**Async Note**: This stage is async (can take 2-4 minutes). Update session.current_stage and progress message periodically.

**Error Handling**:
- If sources can't be found: Still proceed (note in dossier "sources pending")
- If too few sources: Note in dossier and continue
- If LLM output too short: Retry with expanded prompt

---

### Agent 3: Spec Builder

**Purpose**: Translate the profile (brand voice, ICP, content standards) into explicit writer instructions.

**Input**:
- profile: from profiles table (brand_voice, icp, content_standards, research_rules)
- research_dossier: from Researcher (full markdown)
- topic: string
- angle: string

**Instructions** (System Prompt):
```
You are a content strategist building a specification for writers.

TASK: Create an explicit specification that tells a writer EXACTLY how to write this article.

PROFILE BRAND VOICE:
{brand_voice_rules}

PROFILE ICP:
{icp}

CONTENT STANDARDS:
{content_standards}

RESEARCH DOSSIER:
{research_dossier}

BUILD A SPECIFICATION CONTAINING:

1. ARTICLE BRIEF
   - Title (suggested)
   - Hook (how to open)
   - Target reader (who is this for?)
   - Core message (what's the main takeaway?)

2. STRUCTURE (exactly what sections and in what order)
   - Intro (open with [specific element], avoid [clichés])
   - Section 1: [Title]
   - Section 2: [Title]
   - Conclusion: [specific call-to-action]

3. VOICE RULES (explicit dos and don'ts)
   - DO: Use short sentences. Use data. Use "We" when discussing trends.
   - DON'T: Use hedging language ("might", "possibly", "could"). Use corporate jargon.
   - Tone: [specific tone description]

4. CONTENT RULES
   - Must include: [specific element from research]
   - Must prove: [specific claim]
   - Weight heavily: [this research element matters most]
   - Can skip: [this is optional]

5. EXAMPLES
   - How to open (give 1 sentence example)
   - How to cite data (give 1 example)
   - How to close (give 1 sentence example)

OUTPUT: A detailed specification that removes ambiguity.
```

**Output Format**:
```markdown
# Writer Specification: [Topic]

## Article Brief
- Title: [Suggested Title]
- Hook: [How to open]
- Core Message: [What readers should believe after reading]

## Structure
1. Intro: Start with [specific hook], avoid [clichés]
2. Section 1: The Problem
   - Key point: [specific point]
   - Must include: [research element]
3. Section 2: Why It Happens
   ...

## Voice Rules
DO:
- Short sentences (max 15 words)
- Data-driven (cite sources)
- Original insights

DON'T:
- Hedging language
- Corporate jargon

## Content Rules
- MUST PROVE: [specific claim]
- WEIGHT HEAVILY: [research element]
- CAN SKIP: [optional]

## Examples
Opening: "[Example sentence]"
Data citation: "[Example of how to cite]"
Closing: "[Example closing sentence]"
```

**Error Handling**:
- If spec is too vague: Retry with more explicit prompt
- If spec conflicts with research: Note in spec and highlight for writer

---

### Agent 4: Writer

**Purpose**: Write the full article based on the spec and research dossier.

**Input**:
- spec: from Spec Builder (full markdown)
- research_dossier: from Researcher (full markdown)
- topic: string
- angle: string
- profile.brand_voice: for reference

**Instructions** (System Prompt):
```
You are a world-class content writer. Your job is to write an article following the specification exactly.

SPECIFICATION:
{spec}

RESEARCH DOSSIER:
{research_dossier}

WRITE THE ARTICLE:
1. Follow the structure in the specification exactly
2. Follow the voice rules (DO/DON'T)
3. Include the required elements (MUST INCLUDE)
4. Use data from the research dossier
5. Use the examples as tone reference

CRITICAL RULES:
- Write at {depth} depth (light = 800 words, moderate = 1200 words, deep = 1800+ words)
- Match the tone examples in the specification
- Citation: [Author Name], [Year] (in-text format)
- Paragraph length: 2-5 sentences max per paragraph
- No hedging language
- No corporate jargon

OUTPUT: Complete, publishable article in markdown format.
Start with # [Title], then sections.
Include metadata at the top:
---
title: [Title]
description: [1 sentence summary]
date: [today's date]
---
```

**Output Format**:
```markdown
---
title: Why Most AI Content Pipelines Fail
description: AI content tools are becoming ubiquitous, but 80% of implementations fail. Here's why.
date: 2026-08-27
---

# Why Most AI Content Pipelines Fail

## The Problem Nobody Talks About

Most content teams we talk to...

[Full article content]
```

**Async Note**: This stage is async (1-2 minutes). Update progress.

**Error Handling**:
- If output too short: Retry with emphasis on word count
- If output off-tone: Retry with examples
- If output missing sections: Retry with structure emphasis

---

### Agent 5: Editor

**Purpose**: One basic editor (Phase 2 splits into 3 specialized editors). Check for facts, structure, tone.

**Input**:
- draft: from Writer (full markdown)
- research_dossier: from Researcher (for fact-checking)
- spec: from Spec Builder (for tone/structure reference)

**Instructions** (System Prompt):
```
You are an editor. Your job is to review the draft and suggest improvements.

DRAFT:
{draft}

RESEARCH DOSSIER (for fact-checking):
{research_dossier}

SPECIFICATION (for tone/structure):
{spec}

REVIEW FOR:
1. FACTS: Are all claims supported by the research? Flag unsupported claims.
2. STRUCTURE: Does it match the specification? Flag missing sections.
3. TONE: Does it match the voice rules? Flag hedging, jargon, corporate language.
4. FLOW: Do paragraphs flow logically? Flag abrupt transitions.
5. CLARITY: Is it readable? Flag confusing sentences.

OUTPUT:
Return a structured edit in this format:

## EDITS NEEDED (ordered by priority)

### PRIORITY 1 (Critical)
1. [Issue type]: [Location in article] → [Specific problem] → [Suggested fix]

### PRIORITY 2 (Important)
1. [Issue type]: [Location] → [Problem] → [Suggested fix]

### PRIORITY 3 (Nice to have)
1. [Issue type]: [Location] → [Problem] → [Suggested fix]

## SUMMARY
Overall quality: [score 1-10]
Key strengths: [what works well]
Main gap: [biggest issue to fix]

Then, OUTPUT the corrected full draft (apply all Priority 1 edits automatically).
```

**Output Format**:
```markdown
## EDITS NEEDED

### PRIORITY 1 (Critical)
1. FACT-CHECK: Paragraph 3 claims "80% fail" - cite this from research
2. STRUCTURE: Missing "Case Study" section mentioned in spec
3. TONE: Paragraph 5 uses "might fail" (hedging) → rewrite as "fails"

### PRIORITY 2 (Important)
1. FLOW: Transition between intro and section 1 is abrupt
2. CLARITY: Paragraph 4 sentence 2 is too long (32 words)

### PRIORITY 3 (Nice to have)
1. TONE: Opening could be snappier
2. DATA: Consider adding one more stat

---

# EDITED DRAFT

[Full corrected article with all Priority 1 edits applied]
```

**Error Handling**:
- If edit suggestions are vague: Retry with more specific prompt
- If edits contradict spec: Note and highlight for user

---

## Implementation Roadmap

### Week 1-2: Backend Foundation

**Day 1-2: Project Setup**
- [ ] Initialize Node/Express OR Python/FastAPI project
- [ ] Setup PostgreSQL locally (or Docker)
- [ ] Setup environment variables (.env)
- [ ] Create basic project structure (routes/, db/, agents/, utils/)

**Day 3-4: Database**
- [ ] Create PostgreSQL database
- [ ] Write SQL schema (4 tables)
- [ ] Create database migrations
- [ ] Setup connection pool (sqlalchemy or knex.js)
- [ ] Write basic queries (insert session, fetch draft, etc.)

**Day 5-7: API Routes (without agents yet)**
- [ ] POST /run-article (create session, return sessionId)
- [ ] GET /workflow-status/:sessionId (return mock progress)
- [ ] GET /draft/:sessionId/:stage (return mock draft)
- [ ] POST /publish/:sessionId (write file)
- [ ] GET /profiles (return profiles from DB)
- [ ] Add error handling on all routes
- [ ] Test with Postman/curl

**Day 8-10: Orchestrator Skeleton**
- [ ] Create Orchestrator class that manages 5 stages
- [ ] Create placeholder functions for each agent (return mock output)
- [ ] Test orchestrator flow end-to-end (no LLM yet)
- [ ] Add logging to every stage

**Day 11-14: LLM Integration**
- [ ] Setup LLM client (OpenAI, Claude API, etc.)
- [ ] Implement Agent 1: Angle Validator
  - [ ] Test independently (10 test cases)
  - [ ] Verify output parsing
- [ ] Implement Agent 2: Researcher
  - [ ] Test independently (5 test cases)
  - [ ] Handle async execution
- [ ] Implement Agent 3: Spec Builder
  - [ ] Test independently (3 test cases)
- [ ] Implement Agent 4: Writer
  - [ ] Test independently (2 test cases)
  - [ ] Handle async execution
- [ ] Implement Agent 5: Editor
  - [ ] Test independently (1 test case)

**Testing** (ongoing):
- [ ] Run through 3 complete articles end-to-end
- [ ] Check error handling (LLM failures, DB errors, etc.)
- [ ] Verify logging works
- [ ] Check performance (target: <10 minutes per article)

---

### Week 2-3: Frontend

**Day 1-2: Project Setup**
- [ ] Create React + TypeScript project (Create React App or Vite)
- [ ] Setup styling (Tailwind or CSS modules)
- [ ] Setup API client (axios or fetch wrapper)
- [ ] Import DESIGN_SYSTEM_TOKENS.json

**Day 3-4: Layout Components**
- [ ] Create reusable components: Button, Card, Input, Modal
- [ ] Test with DESIGN_SYSTEM_TOKENS.json
- [ ] Ensure responsive (desktop first for Phase 1)

**Day 5-6: Screens 1-2 (Profile Selection, Article Input)**
- [ ] Screen 1: Profile Selection (load profiles from /profiles)
- [ ] Screen 2: Article Input (form with validation)
- [ ] Connect to POST /run-article
- [ ] Test navigation between screens

**Day 7-8: Screens 3-4 (Workflow Monitor, Draft Viewer)**
- [ ] Screen 3: Workflow Monitor (poll /workflow-status every 2 sec)
- [ ] Screen 4: Draft Viewer (load draft from /draft/:sessionId/:stage)
- [ ] Add stage selector dropdown
- [ ] Test with mock API responses

**Day 9-10: Screen 5 (Publish Modal)**
- [ ] Screen 5: Publish Modal
- [ ] Connect to POST /publish/:sessionId
- [ ] Handle file download

**Day 11-14: Polish & Integration**
- [ ] Connect frontend to real backend
- [ ] Test full flow end-to-end
- [ ] Error handling (show error messages)
- [ ] Loading states (spinners, disabled buttons)
- [ ] Test on desktop (Chrome, Safari, Firefox)

---

### Week 4: Polish & Deploy

**Day 1-2: Bug Fixes & Testing**
- [ ] Run 3 test articles, fix any issues
- [ ] Check edge cases (bad input, LLM timeout, etc.)
- [ ] Performance testing (measure actual times)
- [ ] Load testing (what if 10 users run articles?)

**Day 3-4: Documentation**
- [ ] API documentation (endpoints, request/response examples)
- [ ] Setup guide (how to run locally)
- [ ] Environment variables guide (.env.example)
- [ ] LLM cost tracking guide

**Day 5-6: Deployment**
- [ ] Frontend: Deploy to Vercel (or similar)
- [ ] Backend: Deploy to Railway, Heroku, or DigitalOcean
- [ ] Database: Setup PostgreSQL on hosting platform
- [ ] Environment variables configured on platform
- [ ] Secrets managed securely

**Day 7: Launch**
- [ ] Final smoke tests on production
- [ ] Monitor logs for errors
- [ ] Document any issues for Phase 2

---

## Success Criteria

### Functional Success

- [ ] User can select profile
- [ ] User can enter topic, angle, depth
- [ ] Clicking "Run" starts article workflow
- [ ] Each stage shows progress in real-time
- [ ] User can read draft at each stage
- [ ] User can publish to markdown
- [ ] Published file is valid markdown
- [ ] No hallucinations (research validator catches them)
- [ ] Draft is 90%+ publishable (human needs <15 min edits)

### Performance Success

- [ ] Article runs in <10 minutes total
  - Angle Validator: <30 seconds
  - Researcher: 2-4 minutes
  - Spec Builder: <1 minute
  - Writer: 1-2 minutes
  - Editor: <1 minute
- [ ] Workflow status updates every 2 seconds (no lag)
- [ ] Frontend responds to clicks immediately (<500ms)
- [ ] Database queries <100ms

### UX Success

- [ ] New user understands flow without manual
- [ ] Current stage is always clear (timeline shows it)
- [ ] Draft is readable at each stage
- [ ] Error messages are specific (not "something went wrong")
- [ ] No confusing empty states

### Quality Success

- [ ] Agent prompts are testable and documented
- [ ] Every LLM call is logged (for debugging, cost tracking)
- [ ] Error messages guide user to fix issue
- [ ] Code is documented (README per component)
- [ ] Database queries have error handling

### Business Success

- [ ] Cost per article: <$1 in LLM calls
- [ ] Time to market: <4 weeks
- [ ] First user feedback: "I understand why my content looks like this"

---

## Deployment & DevOps

### Environment Variables (.env)

```
# LLM Setup
LLM_API_KEY=sk_...
LLM_MODEL=gpt-4o OR claude-3-5-sonnet
LLM_TIMEOUT=60

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/content_engine
DATABASE_POOL_SIZE=10

# Backend
PORT=3000
NODE_ENV=development OR production
LOG_LEVEL=debug OR info

# Frontend
REACT_APP_API_URL=http://localhost:3000
REACT_APP_ENV=development
```

### Deployment Checklist

**Before Going Live**:
- [ ] All environment variables configured
- [ ] Database backups enabled
- [ ] Error logging configured (Sentry or similar)
- [ ] LLM cost monitoring enabled
- [ ] HTTPS enabled on backend
- [ ] CORS configured correctly
- [ ] Rate limiting enabled (prevent abuse)
- [ ] Secrets not in git (.env in .gitignore)

**Post-Deployment**:
- [ ] Monitor error logs (first 48 hours)
- [ ] Monitor LLM costs
- [ ] Monitor database performance
- [ ] Monitor frontend errors
- [ ] Get user feedback

### Scaling Notes (Phase 2+)

- Current setup handles ~10 concurrent articles
- For 100+ concurrent: Add job queue (Redis + Bull)
- For 1000+ articles/day: Consider caching (research dossiers for common topics)
- Monitor LLM costs as volume grows

---

## Frequently Asked Questions

### Q: How do I handle LLM timeouts?

**A**: In orchestrator, wrap each agent call in try/catch:
```python
try:
  result = call_agent(agent_name, inputs)
except LLMTimeout:
  # Retry up to 2 times
  # If still timeout, update session with error, stop orchestrator
```

### Q: How do I know if a user's input is bad?

**A**: Angle Validator catches bad angles (generic, duplicate). But bad topic/angle input is caught by Angle Validator → returns KILL decision → user prompted to try again.

### Q: How do I prevent cost blowout?

**A**: Monitor LLM costs in logs table. Set alerts at $100/day. Each article should cost <$1. If higher, review agent prompts (they might be asking for too much).

### Q: How do I version profiles?

**A**: Phase 1 doesn't version. Profiles are immutable (once published, don't change). Phase 2 adds versioning.

### Q: Can I run articles in parallel?

**A**: Yes, each article is independent (different session_id). Backend can handle multiple orchestrators running simultaneously.

### Q: How do I debug agent output?

**A**: Every LLM call is logged to logs table. Check logs for: input, output, errors. Each log entry has metadata JSON.

### Q: How long should research take?

**A**: Light depth: 1-2 min, Moderate: 2-4 min, Deep: 4-6 min. If longer, research rules might be too strict or sources hard to find.

### Q: What if the draft quality is bad?

**A**: Review the spec (Agent 3 output). Specs drive quality. If spec is vague, agent 4 (writer) will produce vague output.

---

## Phase 2 Features (Not MVP)

These are NOT in Phase 1. Save for Phase 2:

1. **Draft Editor UI** - Let users edit drafts in the tool
2. **Parallel Editors** - Run 3 editors in parallel, synthesize suggestions
3. **Human Gates** - Pause after Research for human approval
4. **Profile Customization** - Create/edit profiles in UI
5. **Version Comparison** - See how output changes with input tweaks
6. **Multiple Destinations** - Publish to Wordpress, Medium, CMS
7. **Mobile Optimization** - Responsive design for mobile
8. **Analytics** - Track article performance
9. **A/B Testing** - Test different profiles on same topic
10. **Scheduled Publishing** - Publish on specific dates

---

## Summary

**Build this MVP in 3-4 weeks.**

- **Week 1-2**: Backend (DB + orchestrator + 5 agents)
- **Week 2-3**: Frontend (5 screens)
- **Week 4**: Polish + deploy

**Test with 3 complete articles** before launch. Iterate on agent prompts until you're happy with quality.

**The spec is detailed enough that you should have no questions.** If you do, re-read the agent specification section or check EXAMPLE_ARTICLES.md for tone reference.

Good luck. Build fast. Test real articles. Iterate on agent prompts, not the system.

---

**Version:** 1.0  
**Last Updated:** 2026-08-27  
**Status:** Ready for implementation
