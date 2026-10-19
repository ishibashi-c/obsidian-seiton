# Release checklist

## Validate the candidate

- Run `npm ci`, `npm run release:check`, and `git diff --check`.
- Confirm package, lockfile, manifest, and versions map agree.
- Review [network behavior](privacy-and-network.md), attribution, and all third-party licenses.
- Inspect the full source snapshot, release assets, examples, images, and Git commit metadata for credentials and personal data.
- Use synthetic fixtures. Exclude private development history, Vault data, settings, and local review artifacts.
- For behavior changes, verify affected flows in UI Lab and native Obsidian. For the initial release, install the exact release assets in a clean test Vault and check onboarding and primary flows.
- Record checks actually performed and remaining gaps in the release notes.

## Publish after authorization

1. Commit the correct `manifest.json` on the default branch of the public repository.
2. Create a GitHub Release with a tag exactly matching the manifest version, without a `v` prefix. Attach `main.js`, `manifest.json`, and `styles.css` individually.
3. Download and compare the uploaded assets with the verified local build.
4. Sign in to [Obsidian Community](https://community.obsidian.md), connect the owning GitHub account, and submit a new plugin using the public repository URL.
5. Address automated review feedback, then confirm directory installation before announcing availability.

Follow the [official submission guide](https://docs.obsidian.md/plugins/releasing/submit-plugin). The user handles passwords, OAuth consent, and any personal acceptance of developer policies. A GitHub Release does not itself mean the plugin is listed in Community Plugins.
