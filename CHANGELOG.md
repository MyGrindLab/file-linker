# Changelog

All notable changes to this project. Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions follow [SemVer](https://semver.org/).

Every `/feature` and `/fix` run adds **one line** under `[Unreleased]` before the PR is opened — short, user-facing, and written for someone reading the release notes, not the diff. Implementation detail belongs in the PR's agent trace.

## [Unreleased]

### Added
- Kubernetes deployment on a 2-node cluster, reconciled from Git by Argo CD
- Merging to `master` now builds an immutable image and deploys it automatically
<!-- - New capability, one line, with the PR and Jira key: `Health endpoint at /healthz ([#12](...), PROJ-123)` -->

### Changed

### Fixed
- Uploaded HTML and XML files can no longer run scripts on the app's site; shared files are served as plain text with browser protections (KAN-41)
<!-- - The bug as the user experienced it, not the patch: `Login no longer crashes on an empty email ([#13](...), PROJ-124)` -->
