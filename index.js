#!/usr/bin/env node

import { Octokit } from "octokit";

/**
 * Parse GitHub URL to extract owner, repo, and path
 * @param {string} url - GitHub URL like https://github.com/owner/repo/blob/branch/path/to/file
 * @returns {{owner: string, repo: string, path: string}} Parsed components
 */
function parseGitHubUrl(url) {
  const regex = /github\.com\/([^/]+)\/([^/]+)\/blob\/[^/]+\/(.+)/;
  const match = url.match(regex);
  
  if (!match) {
    throw new Error("Invalid GitHub URL. Expected format: https://github.com/owner/repo/blob/branch/path/to/file");
  }
  
  return {
    owner: match[1],
    repo: match[2],
    path: match[3]
  };
}

/**
 * Get the etag for a file
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @returns {Promise<string>} The etag value
 */
async function getEtag(octokit, owner, repo, path) {
  const response = await octokit.request('HEAD /repos/{owner}/{repo}/contents/{path}', {
    owner,
    repo,
    path,
    request: {
      method: 'HEAD'
    }
  });
  
  return response.headers.etag;
}

/**
 * Wait for etag to change
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} initialEtag - Initial etag to compare against
 */
async function waitForEtagChange(octokit, owner, repo, path, initialEtag) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const currentEtag = await getEtag(octokit, owner, repo, path);
        
        if (currentEtag !== initialEtag) {
          clearInterval(interval);
          resolve(currentEtag);
        }
      } catch (error) {
        clearInterval(interval);
        reject(error);
      }
    }, 1000);
  });
}

/**
 * Main function
 */
async function main() {
  const url = process.argv[2];
  
  if (!url) {
    console.error("Error: GitHub URL is required");
    console.error("Usage: await-github-file-change <github-url>");
    console.error("Example: await-github-file-change https://github.com/gr2m/sandbox/blob/main/test-file");
    process.exit(1);
  }
  
  try {
    const { owner, repo, path } = parseGitHubUrl(url);
    
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    console.log(`Monitoring ${owner}/${repo}/${path} for changes...`);
    
    const initialEtag = await getEtag(octokit, owner, repo, path);
    console.log(`Initial etag: ${initialEtag}`);
    
    const newEtag = await waitForEtagChange(octokit, owner, repo, path, initialEtag);
    console.log(`File changed! New etag: ${newEtag}`);
    
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

// Only run main if this file is being executed directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { parseGitHubUrl, getEtag, waitForEtagChange };

