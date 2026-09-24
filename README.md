# Content Engine Tool - Complete Package

This folder contains everything needed to build and launch the Content Engine tool.

## 📁 What's Included

### Core Documentation
- **SUPER_PROMPT.md** - Complete system specification for developers
  - System architecture
  - API endpoints
  - Database schema
  - Agent specifications
  - Implementation roadmap
  - Success criteria
  
  **START HERE** if you're building this.

### Input Templates & Examples
- **PROFILES.yaml** - Pre-built profile templates
  - Thought Leader (Tech SaaS)
  - Educator (General)
  - Contrarian (Enterprise)
  - Researcher/Data-Driven
  
  Each profile has: brand voice, ICP, content standards, research rules

- **existing-content.json** - Sample content map
  - Used by Angle Validator to check for overlaps
  - Shows article angles, publish dates, profiles
  - Replace with your actual content

- **EXAMPLE_ARTICLES.md** - Reference articles
  - Full example of "Thought Leader" voice
  - Analysis of what makes it work
  - Use as tone template for writers

### Design & UX
- **DESIGN_SYSTEM_TOKENS.json** - Complete design tokens
  - Colors, typography, spacing
  - Button styles, card styles, input styles
  - Status icons, breakpoints
  - Import into your frontend directly

## 🚀 Quick Start for Developers

1. **Read SUPER_PROMPT.md** (30 minutes)
   - Understand the vision and architecture
   - See what's in Phase 1 (MVP)

2. **Review the components:**
   - Frontend: Input Manager, Workflow Monitor, Draft Viewer
   - Backend: Orchestrator, Agent System, Draft Manager
   - Database: 4 tables (profiles, sessions, drafts, logs)

3. **Start with Backend (Week 1-2)**
   - Setup Node/Python + Express/FastAPI
   - Create database schema from SUPER_PROMPT.md
   - Implement Orchestrator (manages 5 agents in MVP)
   - Build Agent system (copy agent prompts from SUPER_PROMPT.md)
   - Test with CLI

4. **Move to Frontend (Week 2-3)**
   - Setup React + TypeScript
   - Build forms using DESIGN_SYSTEM_TOKENS.json
   - Implement screens: Input → Workflow → Draft Viewer → Publish
   - Connect to backend API

5. **Polish & Deploy (Week 4)**
   - Error handling
   - Performance optimization
   - Documentation
   - Deploy to Vercel (frontend) + Railway/Heroku (backend)

## 📋 Files to Replace/Customize

1. **existing-content.json**
   - Replace with your actual content map
   - Agent uses this to check angle overlap

2. **PROFILES.yaml**
   - Add/modify profiles for your brand
   - Add more ICPs if needed
   - Update research rules per industry

3. **EXAMPLE_ARTICLES.md**
   - Replace with your best articles
   - Show the exact tone you want AI to match

4. **DESIGN_SYSTEM_TOKENS.json**
   - Customize colors to match your brand
   - Adjust typography/spacing if needed

## 🤖 Understanding the Agents

Five agents in MVP (Phase 1):

1. **Angle Validator** → Checks if angle is distinct from existing content
2. **Researcher** → Gathers sources, creates dossier
3. **Spec Builder** → Translates profile into writer instructions
4. **Writer** → Creates draft based on spec
5. **Editor** → One basic editor (Phase 2 splits into 3)

Each agent has:
- **Input**: What it receives
- **Instructions**: Exact prompt
- **Output**: Format of response

See SUPER_PROMPT.md for each agent's full spec.

## 🎨 Design & UX Resources

**What you DON'T have:**
- Figma file (you need to create screens based on descriptions in SUPER_PROMPT.md)
- Wireframes (descriptions are in SUPER_PROMPT.md "UI/UX Design" section)

**What you DO have:**
- All design tokens (colors, spacing, typography)
- Component specs (buttons, cards, inputs)
- Screen descriptions (exact layout, copy, flow)

**To build the UI:**
1. Use DESIGN_SYSTEM_TOKENS.json for all styling
2. Follow screen descriptions in SUPER_PROMPT.md
3. Create these 6 screens: Profile Selection → Article Input → Workflow Progress → Draft Review → Draft Editor → Publish Modal

## ✅ Success Checklist

**Before you start coding:**
- [ ] Read SUPER_PROMPT.md completely
- [ ] Understand the 5-stage MVP flow
- [ ] Review example articles (know what good looks like)
- [ ] Customize PROFILES.yaml for your brand

**During development:**
- [ ] Build agents one at a time (test independently)
- [ ] Test API endpoints individually (not as a full flow yet)
- [ ] Build frontend screens in order (input → workflow → draft)
- [ ] Log every LLM call (for debugging, cost tracking)

**Before launch:**
- [ ] User can run article in <10 minutes
- [ ] Draft is 90%+ publishable
- [ ] No hallucinations (research validator catches them)
- [ ] UI is responsive and intuitive

## 💡 Pro Tips

1. **Start small**: Test Angle Validator with 10 angles before wiring everything
2. **Watch your costs**: Each article = ~$0.50-1.00 in LLM calls
3. **Log everything**: What ran, how long, what output. Save this for debugging.
4. **Iterate on prompts**: Bad output? Rewrite the agent prompt, not the system.
5. **Use your examples**: EXAMPLE_ARTICLES.md shows what you actually want. Reference it constantly.

## 📞 Questions?

Most answers are in SUPER_PROMPT.md. If not:
1. Check the agent specifications
2. Check the API endpoints
3. Look at EXAMPLE_ARTICLES.md to see what good output looks like

---

**Ready to build.** 🚀

Last updated: 2026-08-27
