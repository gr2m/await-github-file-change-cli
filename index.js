import { Octokit } from "octokit";

/**
 * Parse GitHub URL to extract owner, repo, ref, and path
 * @param {string} url - GitHub URL like https://github.com/owner/repo/blob/branch/path/to/file
 * @returns {{owner: string, repo: string, ref: string, path: string}} Parsed components
 */
function parseGitHubUrl(url) {
  const regex = /github\.com\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)/;
  const match = url.match(regex);
  
  if (!match) {
    throw new Error("Invalid GitHub URL. Expected format: https://github.com/owner/repo/blob/branch/path/to/file");
  }
  
  return {
    owner: match[1],
    repo: match[2],
    ref: match[3],
    path: match[4]
  };
}

/**
 * Get the etag for a file
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} ref - Branch name or commit SHA
 * @returns {Promise<string>} The etag value
 */
async function getEtag(octokit, owner, repo, path, ref) {
  const response = await octokit.request('HEAD /repos/{owner}/{repo}/contents/{path}', {
    owner,
    repo,
    path,
    ref,
    request: {
      method: 'HEAD'
    }
  });
  
  // normalize, e.g. "W/"abc123"" -> "abc123"
 return response.headers.etag.replace(/^W\//, '');
}

/**
 * Wait for etag to change
 * @param {Octokit} octokit - Octokit instance
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} path - File path
 * @param {string} ref - Branch name or commit SHA
 * @param {string} initialEtag - Initial etag to compare against
 */
async function waitForEtagChange(octokit, owner, repo, path, ref, initialEtag) {
  return new Promise((resolve, reject) => {
    const interval = setInterval(async () => {
      try {
        const currentEtag = await getEtag(octokit, owner, repo, path, ref);
        
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
    const { owner, repo, ref, path } = parseGitHubUrl(url);
    
    const octokit = new Octokit({
      auth: process.env.GITHUB_TOKEN
    });
    
    console.log(`Monitoring ${owner}/${repo}/${path} (ref: ${ref}) for changes...`);
    
    const initialEtag = await getEtag(octokit, owner, repo, path, ref);
    console.log(`Initial etag: ${initialEtag}`);
    
    const newEtag = await waitForEtagChange(octokit, owner, repo, path, ref, initialEtag);
    console.log(`File changed! New etag: ${newEtag}`);
    
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

export { parseGitHubUrl, getEtag, waitForEtagChange, main };

