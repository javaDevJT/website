title: Terminal-Style Portfolio Website
type: Personal Project
year: 2025
technologies: React 19, TypeScript, Spring Boot, Java 21, Vite, Tailwind CSS, Framer Motion, Docker, Spring WebFlux, Axios, Maven

# Terminal-Style Portfolio Website

## You Are Here!

This is the portfolio website you're currently using! A unique, Linux terminal-themed interface that showcases my work through an interactive command-line experience.

## Key Features

### 🖥️ Terminal Interface
- **Full terminal emulation** with command history and auto-completion
- **Typing animations** for authentic terminal feel
- **6 color themes** (Classic, Amber, Blue, Hacker, Synthwave, Light)
- **CRT scan lines effect** for retro aesthetic
- **Mobile command palette** for touch devices

### Design Philosophy
- **Unconventional UI** - No traditional navigation menus
- **Command-based interaction** - Navigate via terminal commands
- **ASCII art** throughout for visual interest
- **Accessibility** - WCAG 2.1 AA compliant with ARIA labels

### Technical Implementation

**Frontend:**
- React 19 with TypeScript for type safety
- Vite for blazing-fast builds
- Tailwind CSS for utility-first styling
- Framer Motion for smooth animations
- Custom terminal emulator component

**Backend:**
- Spring Boot with WebFlux (reactive)
- RESTful API endpoints
- Markdown content system with frontmatter parsing
- Blog metadata and portfolio filtering
- Real-time server metrics integration

**Features:**
- ✅ Blog listing and search
- ✅ Portfolio filtering by technology
- ✅ Dynamic content from markdown files
- ✅ Error boundaries for fault tolerance
- ✅ Theme persistence with localStorage
- ✅ Multi-stage Docker builds
- ✅ CI/CD with GitHub Actions

### Commands Available
```bash
help          # List all commands
portfolio     # View all projects (including this one!)
blog          # Browse blog posts
theme <name>  # Change color scheme
scanlines     # Toggle CRT effect
neofetch      # System info with ASCII art
...and many more easter eggs!
```

### Architecture

```
Frontend (React + TypeScript)
    ↓
Vite Build → Static Assets
    ↓
Spring Boot (WebFlux)
    ↓
Markdown Files (Portfolio/Blog)
    ↓
REST API Endpoints
```

### Deployment
- **Containerized** with multi-stage Docker build
- **CI/CD Pipeline** with GitHub Actions
- **Production-ready** with Nginx reverse proxy
- **Multi-platform** support (AMD64 + ARM64)

## Why This Approach?

Most portfolios look the same - navbar, hero section, cards. I wanted something that would:
1. **Stand out** from typical portfolio sites
2. **Showcase technical skills** through the interface itself
3. **Be fun to use** and explore
4. **Demonstrate full-stack capabilities** (React frontend + Spring Boot backend)

## Meta Achievement Unlocked
You're reading about this website... on this website... from a portfolio command that lists this project.

Try these commands to explore:
- `ls` - See what's in the current directory
- `cd blog` - Navigate to blog posts
- `tree` - Visual directory structure
- `theme synthwave` - Try a different color scheme
- `secrets` - Find hidden easter eggs

---

**Live Demo:** You're using it right now!  
**Source:** Private repository  
**Status:** ✅ Active & Continuously Enhanced