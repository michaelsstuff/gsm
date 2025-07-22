# Copilot Memory Bank & Project Instructions

## Summary
This document defines how GitHub Copilot maintains project memory and context across sessions. Copilot's memory resets between sessions, so all project knowledge must be captured in the Memory Bank to ensure continuity, accuracy, and effective collaboration.

---

## Core Principle
**Copilot MUST read ALL memory bank files at the start of EVERY task.**
* No exceptions.
* Use this checklist before any work:
  * [ ] Read `projectbrief.md`
  * [ ] Read `productContext.md`
  * [ ] Read `systemPatterns.md`
  * [ ] Read `techContext.md`
  * [ ] Read `activeContext.md`
  * [ ] Read `progress.md`
  * [ ] Read `copilot-rules.md`
  * [ ] Read any additional context files in `/memory-bank/`

---

## Memory Bank Structure
The Memory Bank consists of required core files and optional context files, all in Markdown. Files build upon each other in a clear hierarchy:

### Core Files (Required)
1. **projectbrief.md**
   Foundation document for all others. Defines core requirements, goals, and project scope.

2. **productContext.md**
   Why this project exists, problems it solves, user experience goals.

3. **systemPatterns.md**
   System architecture, key technical decisions, design patterns, component relationships.

4. **techContext.md**
   Technologies used, development setup, technical constraints, dependencies.

5. **activeContext.md**
   Current work focus, recent changes, next steps, active decisions.

6. **progress.md**
   What works, what's left to build, current status, known issues.

7. **copilot-rules.md**
   Project rules, Copilot guidance, safety/security policies, evolving project patterns.

### Additional Context
Add extra files/folders in `/memory-bank/` for:
* Complex features
* Integration specs
* API docs
* Testing strategies
* Deployment procedures

---

## Core Workflows

### Plan Mode
**Description:**
* Always start by reading all memory bank files.
* If files are missing, create a plan and document it.
* If files are complete, verify context and develop a strategy before acting.

### Act Mode
**Description:**
* Read memory bank files to understand current state.
* Focus on `activeContext.md` and `progress.md` for current state.
* Update memory bank files as work progresses.

---

## Project Rules (`copilot-rules.md`)
This file is Copilot's and the team's learning journal for the project. It captures:
* Critical implementation paths
* User preferences and workflow
* Project-specific patterns
* Security requirements and known challenges
* Evolution of project decisions
* Tool usage patterns

---

## How to Use This Document
* Reference this file at the start of every session.
* Use the checklists to guide your workflow.
* Update the Memory Bank and `copilot-rules.md` as you learn.
* Treat this as a living document—improve it as the project evolves.

---

**REMEMBER:**
After every memory reset, Copilot begins completely fresh. The Memory Bank is the only link to previous work. Maintain it with precision and clarity—project effectiveness and security depend on its accuracy.
