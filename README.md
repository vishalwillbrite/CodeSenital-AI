# CodeSentinel AI 

**AI-Powered Code Review & Static Application Security Testing (SAST)**

CodeSentinel AI is an intelligent code analysis platform designed to help developers identify potential security vulnerabilities, logic errors, performance issues, and coding best-practice violations. It combines AI-powered analysis with GitHub repository integration to make code reviews more efficient and actionable.

##  Features

- **AI-Powered Code Review** — Analyze source code and receive structured findings with explanations and suggested fixes.
- **Security Vulnerability Detection** — Identify potential issues such as SQL injection, Cross-Site Scripting (XSS), and other insecure coding patterns.
- **GitHub Integration** — Connect repositories through a GitHub App and browse authorized source files.
- **Pull Request Analysis** — Review changes in pull requests to identify potential risks before merging.
- **Severity Classification** — Organize findings by severity to help prioritize remediation.
- **Review History** — Access previously saved code reviews.
- **GitHub Authentication** — Sign in securely using GitHub OAuth.
- **Theme Customization** — Customize the interface for a more comfortable development experience.

##  Tech Stack

| Layer | Technologies |
|---|---|
| Frontend | Next.js, React, TypeScript, Tailwind CSS |
| Backend | NestJS, Node.js, TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| AI Engine | Google Gemini API |
| Authentication | GitHub OAuth |
| Repository Integration | GitHub Apps API |
| Testing | Jest |

##  Architecture

```text
CodeSentinel AI
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── infra/            # Infrastructure configuration
├── scratch/          # Local verification scripts
└── package.json      # Workspace configuration
```

##  Getting Started

### Prerequisites

- Node.js and npm
- PostgreSQL
- A Google Gemini API key
- A GitHub OAuth App
- A GitHub App for repository access

### 1. Clone the repository

```bash
git clone <YOUR_REPOSITORY_URL>
cd codesentinel-ai
```

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create the required environment files using the provided `.env.example` templates. Configure the database connection, GitHub OAuth credentials, GitHub App credentials, JWT secret, and Gemini API key.

**Never commit actual credentials, private keys, or `.env` files.**

### 4. Set up the database

Validate the Prisma schema and generate the client:

```bash
npx prisma validate --schema=apps/api/prisma/schema.prisma
npx prisma generate --schema=apps/api/prisma/schema.prisma
```

Apply existing migrations:

```bash
npx prisma migrate deploy --schema=apps/api/prisma/schema.prisma
```

Ensure PostgreSQL is running and the configured database exists before starting the application.

### 5. Start the application

Use the workspace scripts defined in the root `package.json` to start the API and frontend. For example, if the scripts are configured:

```bash
npm run dev:api
npm run dev:web
```

Open the frontend at `http://localhost:3000` and the API at `http://localhost:4000`.

### 6. Connect GitHub

1. Sign in using GitHub OAuth.
2. Open the Repositories section.
3. Install the GitHub App and authorize selected repositories.
4. Browse source files and initiate code reviews.
5. Review findings and suggested fixes.

##  Security

- Keep API keys, OAuth secrets, JWT signing secrets, and GitHub App private keys server-side.
- Grant only the repository permissions required by the application.
- Restrict repository access to the authenticated user.
- Validate user input and repository file paths.
- Use HTTPS, secure cookies, appropriate rate limiting, and production-grade secret management when deploying.

AI-generated findings are recommendations and should be reviewed before applying changes. CodeSentinel AI does not replace comprehensive security testing or human review.

##  Testing

Run backend tests:

```bash
npm run test --workspace=api
```

Build the frontend:

```bash
npm run build --workspace=web
```

##  Roadmap

- Expand vulnerability detection and remediation guidance.
- Improve pull request analysis and review reporting.
- Enhance repository-level security insights.
- Strengthen production monitoring and deployment readiness.

##  Contributing

Contributions, suggestions, and bug reports are welcome. Fork the repository, create a feature branch, and submit a pull request describing your changes.

##  License

A license has not yet been specified. Add a `LICENSE` file before distributing the project under an open-source license.

---

**CodeSentinel AI** — Write safer code. Review smarter. Build with confidence.
