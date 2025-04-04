# Hebo Eval

A CLI tool for evaluating and testing language models.

## Installation

### Global Installation (Recommended)

You can install Hebo Eval globally using npm:

```bash
npm install -g hebo-eval
```

Or using yarn:

```bash
yarn global add hebo-eval
```

### Using npx (No Installation)

You can run Hebo Eval without installing it using npx:

```bash
npx hebo-eval
```

## Usage

### Basic Commands

Check the version:

```bash
hebo-eval --version
```

Display help:

```bash
hebo-eval --help
```

## Development

### Prerequisites

- Node.js >= 18.0.0
- npm or yarn

### Setup

1. Clone the repository:

```bash
git clone https://github.com/yourusername/hebo-eval.git
cd hebo-eval
```

2. Install dependencies:

```bash
npm install
```

3. Build the project:

```bash
npm run build
```

### Development Commands

- `npm run build` - Build the project
- `npm run dev` - Watch mode for development
- `npm test` - Run tests
- `npm run lint` - Run linter
- `npm run format` - Format code

### Publishing to npm

#### Manual Publishing

1. Create an npm account if you don't have one:

   ```bash
   npm adduser
   ```

2. Login to your npm account:

   ```bash
   npm login
   ```

3. Before publishing, make sure to:

   - Update the version in package.json (`npm version patch|minor|major`)
   - Build the project (`npm run build`)
   - Run tests (`npm test`)
   - Check the package contents (`npm pack --dry-run`)

4. Publish the package:
   ```bash
   npm publish
   ```

#### Automated Publishing

The package is automatically published to npm when a new tag is pushed to the repository. The process:

1. Updates the version in package.json
2. Creates a git tag
3. Pushes the tag to trigger the GitHub Action

Example workflow:

```bash
# Update version
npm version patch  # or minor/major

# Push changes and tag
git push --follow-tags
```

The GitHub Action will:

- Verify the package version matches the tag
- Run tests
- Build the project
- Publish to npm

#### Publishing Checklist

- [ ] Update version number
- [ ] Update changelog (if applicable)
- [ ] Run tests
- [ ] Build project
- [ ] Check package contents
- [ ] Create and push git tag
- [ ] Verify automated publish

## License

MIT
