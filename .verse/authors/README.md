# Author Profiles

Each file in this directory links a GitHub identity to other identity systems.

Files are named `{github-username}.json` and contain verified identity claims.

## Verification

- **GitHub**: Verified by the act of creating the issue (authenticated by GitHub)
- **Ethereum**: Verified via ERC-4361 (Sign-In with Ethereum) signature
- **WebID**: Verified by checking that the WebID document links back to this GitHub account
- **DID**: Verified by resolving the DID document and checking for a GitHub proof

Unverified claims are stored with `"verified": false` until proof is provided.
