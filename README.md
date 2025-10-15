# await-github-file-change-cli

A CLI tool that monitors a GitHub file for changes by polling its etag value. The tool will continuously check the file every second until it detects a change, then exit.

## Usage

You can run this tool directly using `npx` without installing it:

```bash
npx await-github-file-change-cli https://github.com/owner/repo/blob/branch/path/to/file
```

### Example

```bash
npx await-github-file-change-cli https://github.com/gr2m/sandbox/blob/main/test-file
```

## Authentication

For higher rate limits and access to private repositories, set the `GITHUB_TOKEN` environment variable:

```bash
GITHUB_TOKEN=your_token_here npx await-github-file-change-cli https://github.com/owner/repo/blob/branch/path/to/file
```

## How it works

1. Parses the GitHub URL to extract owner, repository, and file path
2. Fetches the initial etag value using a HEAD request
3. Polls the file every second with HEAD requests
4. When the etag changes, logs the new etag and exits

## Installation

If you want to install it globally:

```bash
npm install -g await-github-file-change-cli
```

Then use it directly:

```bash
await-github-file-change https://github.com/owner/repo/blob/branch/path/to/file
```

## Development

### Install dependencies

```bash
npm install
```

### Run tests

```bash
npm test
```

## License

[ISC](LICENSE)

