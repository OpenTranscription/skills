# OpenTranscription Skills Changelog

All notable changes to `@opentranscription/sdk`, `@opentranscription/cli` and the
bundled Agent Skill are documented in this file.

The two packages share one version number: they are released together, and the
CLI pins the SDK exactly. The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

# 0.1.0 (2026-08-19)


### Bug Fixes

* **sdk,cli:** fix the upload shape, back off on 429, thin the section index ([ccb3ca3](https://github.com/OpenTranscription/skills/commit/ccb3ca3a13d504e8ce76772559597446865722a7))
* **sdk,cli:** point at the real API, and make the catalogue public ([2998e0e](https://github.com/OpenTranscription/skills/commit/2998e0e6cc0ad64cb469e88a7ce772d7ffc7513c))


### Features

* **cli:** add ot show, and CI with a spec-drift check ([5f16b10](https://github.com/OpenTranscription/skills/commit/5f16b10a49e1a4c3712ecc46000adba4ddbabee4))
* **cli:** add the device-flow client and per-org credential store ([4570445](https://github.com/OpenTranscription/skills/commit/457044533cce2c97856741eec6d67e874301d150))
* **cli:** add the output contract, commands and the ot binary ([4292eda](https://github.com/OpenTranscription/skills/commit/4292edab645a829480b081b4277e0f2c3771fa19))
* **sdk:** add the typed client with upload and polling ([dd0d08b](https://github.com/OpenTranscription/skills/commit/dd0d08b5a5cfd7e5f34ae83793d09643bd7972b8))
* **skill:** add SKILL.md, troubleshooting, README and the catalog commands ([a5d131c](https://github.com/OpenTranscription/skills/commit/a5d131c05027801874bcffb776c959d1b63a090f))
