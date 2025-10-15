import { describe, it, mock } from 'node:test';
import assert from 'node:assert';
import { parseGitHubUrl, getEtag, waitForEtagChange } from './index.js';

describe('parseGitHubUrl', () => {
  it('should parse a valid GitHub URL', () => {
    const url = 'https://github.com/gr2m/sandbox/blob/main/test-file';
    const result = parseGitHubUrl(url);
    
    assert.strictEqual(result.owner, 'gr2m');
    assert.strictEqual(result.repo, 'sandbox');
    assert.strictEqual(result.ref, 'main');
    assert.strictEqual(result.path, 'test-file');
  });

  it('should parse a GitHub URL with nested path', () => {
    const url = 'https://github.com/owner/repo/blob/main/path/to/file.txt';
    const result = parseGitHubUrl(url);
    
    assert.strictEqual(result.owner, 'owner');
    assert.strictEqual(result.repo, 'repo');
    assert.strictEqual(result.ref, 'main');
    assert.strictEqual(result.path, 'path/to/file.txt');
  });

  it('should parse a GitHub URL with different branch name', () => {
    const url = 'https://github.com/owner/repo/blob/develop/file.js';
    const result = parseGitHubUrl(url);
    
    assert.strictEqual(result.owner, 'owner');
    assert.strictEqual(result.repo, 'repo');
    assert.strictEqual(result.ref, 'develop');
    assert.strictEqual(result.path, 'file.js');
  });

  it('should parse a GitHub URL with commit SHA', () => {
    const url = 'https://github.com/owner/repo/blob/abc123def456/file.js';
    const result = parseGitHubUrl(url);
    
    assert.strictEqual(result.owner, 'owner');
    assert.strictEqual(result.repo, 'repo');
    assert.strictEqual(result.ref, 'abc123def456');
    assert.strictEqual(result.path, 'file.js');
  });

  it('should throw error for invalid URL', () => {
    const url = 'https://example.com/invalid/url';
    
    assert.throws(() => {
      parseGitHubUrl(url);
    }, {
      message: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo/blob/branch/path/to/file'
    });
  });

  it('should throw error for GitHub URL without blob path', () => {
    const url = 'https://github.com/owner/repo';
    
    assert.throws(() => {
      parseGitHubUrl(url);
    }, {
      message: 'Invalid GitHub URL. Expected format: https://github.com/owner/repo/blob/branch/path/to/file'
    });
  });
});

describe('getEtag', () => {
  it('should return etag from response headers', async () => {
    const mockOctokit = {
      request: mock.fn(async () => ({
        headers: {
          etag: 'W/"abc123"'
        }
      }))
    };

    const etag = await getEtag(mockOctokit, 'owner', 'repo', 'path/to/file', 'main');
    
    assert.strictEqual(etag, 'W/"abc123"');
    assert.strictEqual(mockOctokit.request.mock.callCount(), 1);
    
    const callArgs = mockOctokit.request.mock.calls[0].arguments;
    assert.strictEqual(callArgs[0], 'HEAD /repos/{owner}/{repo}/contents/{path}');
    assert.deepStrictEqual(callArgs[1], {
      owner: 'owner',
      repo: 'repo',
      path: 'path/to/file',
      ref: 'main',
      request: {
        method: 'HEAD'
      }
    });
  });

  it('should handle different etag formats', async () => {
    const mockOctokit = {
      request: mock.fn(async () => ({
        headers: {
          etag: '"xyz789"'
        }
      }))
    };

    const etag = await getEtag(mockOctokit, 'owner', 'repo', 'file.txt', 'develop');
    
    assert.strictEqual(etag, '"xyz789"');
  });

  it('should pass commit SHA as ref', async () => {
    const mockOctokit = {
      request: mock.fn(async () => ({
        headers: {
          etag: 'W/"commit-etag"'
        }
      }))
    };

    const etag = await getEtag(mockOctokit, 'owner', 'repo', 'file.txt', 'abc123def456');
    
    assert.strictEqual(etag, 'W/"commit-etag"');
    const callArgs = mockOctokit.request.mock.calls[0].arguments;
    assert.strictEqual(callArgs[1].ref, 'abc123def456');
  });
});

describe('waitForEtagChange', () => {
  it('should resolve when etag changes', async (t) => {
    let callCount = 0;
    const mockOctokit = {
      request: mock.fn(async () => {
        callCount++;
        return {
          headers: {
            etag: callCount > 2 ? 'W/"new-etag"' : 'W/"old-etag"'
          }
        };
      })
    };

    const promise = waitForEtagChange(mockOctokit, 'owner', 'repo', 'path', 'main', 'W/"old-etag"');
    
    const newEtag = await promise;
    
    assert.strictEqual(newEtag, 'W/"new-etag"');
    assert.ok(mockOctokit.request.mock.callCount() >= 3);
  });

  it('should reject when request fails', async (t) => {
    const mockOctokit = {
      request: mock.fn(async () => {
        throw new Error('API Error');
      })
    };

    await assert.rejects(
      async () => {
        await waitForEtagChange(mockOctokit, 'owner', 'repo', 'path', 'main', 'W/"etag"');
      },
      {
        message: 'API Error'
      }
    );
  });

  it('should immediately resolve if etag is already different', async (t) => {
    const mockOctokit = {
      request: mock.fn(async () => ({
        headers: {
          etag: 'W/"different-etag"'
        }
      }))
    };

    const newEtag = await waitForEtagChange(mockOctokit, 'owner', 'repo', 'path', 'develop', 'W/"old-etag"');
    
    assert.strictEqual(newEtag, 'W/"different-etag"');
    assert.strictEqual(mockOctokit.request.mock.callCount(), 1);
  });

  it('should pass ref to getEtag calls', async (t) => {
    const mockOctokit = {
      request: mock.fn(async () => ({
        headers: {
          etag: 'W/"different-etag"'
        }
      }))
    };

    await waitForEtagChange(mockOctokit, 'owner', 'repo', 'path', 'abc123def456', 'W/"old-etag"');
    
    const callArgs = mockOctokit.request.mock.calls[0].arguments;
    assert.strictEqual(callArgs[1].ref, 'abc123def456');
  });
});

