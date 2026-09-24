# Developer Checklist - Content Engine Tool

Use this to make sure you understand what needs to be built.

## Phase 1 (MVP) - Complete Checklist

### Backend Setup
- [ ] Create project (Node.js + Express OR Python + FastAPI)
- [ ] Setup PostgreSQL database
- [ ] Create tables: profiles, sessions, drafts, logs (schema in SUPER_PROMPT.md)
- [ ] Setup environment variables (.env)
- [ ] Create basic API structure (routes, middleware)

### Database
- [ ] profiles table (stores YAML profiles as JSON)
- [ ] sessions table (tracks active article runs)
- [ ] drafts table (saves draft at each stage)
- [ ] logs table (logs every event)
- [ ] Can query existing content (for angle validation)

### API Routes
- [ ] POST /run-article (start new article)
- [ ] GET /workflow-status/:sessionId (real-time progress)
- [ ] GET /draft/:sessionId/:stage (retrieve draft at stage)
- [ ] POST /publish/:sessionId (publish to markdown)
- [ ] GET /profiles (fetch all profiles)
- [ ] Error handling on all routes (specific error messages)
- [ ] Logging on all routes (what ran, how long, output)

### Orchestrator (Core Logic)
Manages flow: Angle Check → Research → Spec → Write → Edit → Publish

- [ ] Stage 1: Angle Validator (run agent)
  - [ ] Input: topic, angle, existing content
  - [ ] Output: proceed/pivot/kill decision
  - [ ] Gate: if pivot/kill, return decision
  
- [ ] Stage 2: Researcher (run agent, async)
  - [ ] Input: topic, angle, research rules
  - [ ] Output: research dossier (markdown)
  - [ ] Save to drafts table
  
- [ ] Stage 3: Spec Builder (run agent)
  - [ ] Input: profile, research dossier
  - [ ] Output: writer specification
  - [ ] Save to drafts table
  
- [ ] Stage 4: Writer (run agent, async)
  - [ ] Input: spec, research dossier
  - [ ] Output: full draft
  - [ ] Save to drafts table
  
- [ ] Stage 5: Editor (run agent)
  - [ ] Input: draft
  - [ ] Output: edit suggestions + corrected draft
  - [ ] Save to drafts table
  
- [ ] All stages: Update session.current_stage as you go
- [ ] All stages: Log start/end times
- [ ] Error handling: Catch LLM failures, return specific error

### LLM Agents (5 for MVP)
- [ ] Agent 1: Angle Validator (input/instructions/output from SUPER_PROMPT.md)
- [ ] Agent 2: Researcher (input/instructions/output from SUPER_PROMPT.md)
- [ ] Agent 3: Spec Builder (input/instructions/output from SUPER_PROMPT.md)
- [ ] Agent 4: Writer (input/instructions/output from SUPER_PROMPT.md)
- [ ] Agent 5: Editor (simplified - structure + basic fact check, see SUPER_PROMPT.md)
- [ ] Each agent has clear, testable prompt
- [ ] Error handling for LLM timeouts/failures
- [ ] Cost tracking (log tokens used)

### Frontend Setup
- [ ] Create React + TypeScript project
- [ ] Setup styling (use DESIGN_SYSTEM_TOKENS.json)
- [ ] Setup API client (axios/fetch)
- [ ] Setup state management (Context or Zustand)

### Frontend Screens
- [ ] Screen 1: Profile Selection
  - [ ] Load profiles from backend
  - [ ] Show profile name, description, last used
  - [ ] "Use This" button to select
  
- [ ] Screen 2: Article Input
  - [ ] Text input: topic
  - [ ] Text input: angle
  - [ ] Radio buttons: depth (light/moderate/deep)
  - [ ] Validation (show checkmarks)
  - [ ] "Run Article" button
  
- [ ] Screen 3: Workflow Monitor
  - [ ] Visual timeline of stages
  - [ ] Current stage highlighted
  - [ ] Poll /workflow-status every 2 seconds
  - [ ] Show real-time progress (research found X/5 sources, etc.)
  - [ ] Status icons: ✓ ⏳ ◯
  
- [ ] Screen 4: Draft Viewer
  - [ ] Display draft from /draft/:sessionId/:stage
  - [ ] Stage selector dropdown (switch between research/write/edit)
  - [ ] "Publish" button
  
- [ ] Screen 5: Publish Modal
  - [ ] Destination selector (markdown only for MVP)
  - [ ] "Publish" button
  - [ ] Show confirmation

### UX/Design
- [ ] Use DESIGN_SYSTEM_TOKENS.json for all styling
- [ ] Colors: success (#10b981), warning (#f59e0b), error (#ef4444)
- [ ] Buttons: primary (green) for main actions
- [ ] Cards for section grouping (16px gap between sections)
- [ ] Status indicators: ✓ ⏳ ◯ ✕ ⚠️ ℹ️
- [ ] Responsive: works on desktop (mobile Phase 2)

### Testing
- [ ] Test Angle Validator alone (10 different angles)
- [ ] Test Researcher alone (5 different topics)
- [ ] Test Spec Builder alone (3 different profiles)
- [ ] Test Writer alone (2 different specs)
- [ ] Test Editor alone (1 draft)
- [ ] Test end-to-end: run article from start to publish
- [ ] Test error cases: bad input, LLM timeout, etc.

### Documentation
- [ ] Code comments for complex logic
- [ ] API documentation (endpoint descriptions)
- [ ] Setup instructions (how to run locally)
- [ ] Environment variables (.env.example)

### Deployment
- [ ] Frontend: Vercel (or similar)
- [ ] Backend: Railway, Heroku, or similar
- [ ] Database: PostgreSQL hosting
- [ ] Environment variables configured
- [ ] Secrets securely managed (.env)

---

## What NOT to Include in Phase 1

Don't build these yet (Phase 2):
- [ ] Draft editing in tool
- [ ] Parallel edits (run sequential only)
- [ ] Human gates/pauses
- [ ] Profile customization UI
- [ ] Mobile optimization
- [ ] Version comparison/correlation
- [ ] Multiple destinations (markdown only)

---

## Success Criteria for MVP

### Functional
- [ ] User can select profile
- [ ] User can enter topic + angle + depth
- [ ] Clicking "Run" starts the workflow
- [ ] Each stage shows progress in real-time
- [ ] User can read draft after each stage
- [ ] User can publish to markdown
- [ ] Published file is valid markdown
- [ ] No hallucinations in output (research validator catches them)
- [ ] Draft is 90%+ publishable (human needs <15 min edits)

### Performance
- [ ] Article runs in <10 minutes (research ~3-4 min, write ~2 min, edit ~1 min)
- [ ] Workflow status updates every 2 seconds (polling)
- [ ] Frontend is responsive (click → immediate feedback)

### UX
- [ ] New user understands flow without manual
- [ ] Current stage is always clear
- [ ] Draft is readable at each stage
- [ ] Error messages are specific (not "something went wrong")
- [ ] No confusing empty states

### Code Quality
- [ ] Agents have testable prompts (documented)
- [ ] Every LLM call is logged
- [ ] Error messages are specific
- [ ] Code is documented
- [ ] Database queries have error handling

---

## Red Flags (Don't Ship If...)

- [ ] User can't see what's happening (black box)
- [ ] Output quality is inconsistent
- [ ] Agent prompts are vague (rewrite them)
- [ ] No way to debug failures
- [ ] API routes return generic errors
- [ ] Frontend takes >2 sec to respond to clicks
- [ ] Research validator isn't catching hallucinations

---

## Before Handoff to User

- [ ] Test with sample inputs from EXAMPLE_ARTICLES.md
- [ ] Try with PROFILES.yaml profiles
- [ ] Output should match the tone of examples
- [ ] Run 3 test articles (should be publishable with <15 min edits)
- [ ] Deploy to staging, get feedback
- [ ] Fix any issues, then move to production

---

## Quick Reference

**Architecture:**
- Frontend → API → Orchestrator → Agents → DB

**MVP Agents (5):**
1. Angle Validator
2. Researcher
3. Spec Builder
4. Writer
5. Editor (simplified)

**MVP Screens (5):**
1. Profile Selection
2. Article Input
3. Workflow Monitor
4. Draft Viewer
5. Publish Modal

**Key Files:**
- SUPER_PROMPT.md (all specs)
- DESIGN_SYSTEM_TOKENS.json (styling)
- PROFILES.yaml (templates)
- EXAMPLE_ARTICLES.md (tone reference)

---

Print this. Check boxes as you go. This is your blueprint.
