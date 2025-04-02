## Commands

- Run development server: `yarn dev`
- Build: `yarn build`
- Lint: `yarn lint`
- Typecheck: `yarn typecheck` (implied by `yarn build`)
- Test: `yarn test` (assuming Jest or similar, specific command not found)
- Run single test: `yarn test <path/to/test/file>` (assuming Jest or similar)

## Code Style

- **Framework**: Next.js with TypeScript and React.
- **Formatting**: Follow standard TypeScript/React formatting, likely enforced by Prettier (config not found, but common). Use ESLint for linting (`yarn lint`).
- **Imports**: Organize imports alphabetically. Use named imports where possible. Avoid default exports for components/pages.
- **Types**: Use TypeScript for strong typing. Define interfaces or types for props, state, and API responses. Avoid `any`.
- **Naming Conventions**:
    - Components: PascalCase (e.g., `MyComponent.tsx`)
    - Files/Folders: kebab-case (e.g., `vertical-tree`)
    - Variables/Functions: camelCase (e.g., `fetchData`)
    - Constants: UPPER_SNAKE_CASE (e.g., `API_URL`)
- **Error Handling**: Use try/catch blocks for async operations. Handle API errors gracefully in the UI.
- **Components**: Prefer functional components with Hooks. Keep components small and focused.
- **State Management**: Use React's built-in state (useState, useReducer) or context API for simple cases. Consider Zustand or Redux for complex global state (no evidence of use yet).
- **Styling**: Tailwind CSS is used (based on `postcss.config.mjs` and typical Next.js setups). Define styles directly in components or use `@apply` for reusable classes if needed.
