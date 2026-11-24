SHELL := /bin/bash
.DEFAULT_GOAL := help
BUN ?= bun
-include .env
export
VAE := python3 tmp/vae-tooling/plugin/scripts/vae.py

.PHONY: help setup build site dev lint test coverage e2e verify bench bench-scale bench-scan bench-parallel bench-redis bench-frames metrics vae-setup vae prose release start stop restart status log
help: ## List available targets.
	@awk 'BEGIN {FS = ":.*## "} /^[a-zA-Z_-]+:.*## / {printf "%-15s %s\n", $$1, $$2}' $(MAKEFILE_LIST)
setup: ## Install pinned dependencies (Node, Bun, Redis), Chromium, WebKit and the VAE runtime.
	@if command -v mise >/dev/null 2>&1; then mise install; fi
	$(BUN) install --frozen-lockfile
	$(BUN) x playwright install chromium webkit
	$(BUN) scripts/vae.ts
build: ## Build ESM, CommonJS and declarations.
	$(BUN) run build
site: build ## Bundle the website demos into docs/assets from the built package.
	$(BUN) scripts/site.ts
dev: site ## Rebuild the demos and serve the website from docs/ on http://127.0.0.1:3000.
	$(BUN) x serve@14.2.6 docs --listen tcp://127.0.0.1:3000 --no-clipboard
lint: ## Typecheck, lint and enforce source-folder architecture documentation.
	$(BUN) run lint
	$(BUN) x tsc -p tsconfig.browser.json
	$(BUN) x tsc -p tsconfig.site.json
	$(BUN) scripts/check-architecture.ts
test: ## Test actual memory and native storage, replay and recovery.
	$(BUN) run test
coverage: ## Measure production-code coverage with enforced thresholds.
	$(BUN) run coverage
e2e: build ## Install the tarball and test Node, Bun, real Chromium workers and the website in WebKit at iPhone size.
	$(BUN) scripts/e2e.ts
verify: lint test coverage e2e ## Execute the complete automated verification suite.
bench: build ## Compare v0.2.0, v0.3.0 and the current build across Node/Bun, native async/sync and memory.
	$(BUN) scripts/bench.ts
bench-scale: build ## Compare the three builds on 10000-record native async workloads, three measured rounds.
	$(BUN) scripts/bench.ts --scale
bench-scan: build ## Time full scans of 100000 documents, row by row and in batches, against the vendored 0.5.0.
	$(BUN) scripts/bench-scan.ts
bench-parallel: build ## Time a full native scan of 100000 documents in one thread against split() ranges in 1, 2, 4 and 8 worker threads.
	$(BUN) scripts/bench-parallel.ts
bench-redis: build ## Compare the current build with a throwaway loopback Redis (pinned in mise.toml): reads, batches and transactions.
	$(BUN) scripts/bench-redis.ts
bench-frames: build ## Time committing 10000 records as values through batch against caller-encoded frames through batchFrames, under Node and Bun.
	$(BUN) scripts/bench-frames.ts
metrics: ## Print the last benchmark report.
	@cat output/bench.json
vae-setup: ## Extract the pinned VAE runtime without network access.
	$(BUN) scripts/vae.ts
vae: vae-setup ## Run VAE verification, review and documentation gates.
	$(VAE) gate --repo . --session dbsonl-release
prose: vae-setup ## Check project documentation with VAE.
	$(VAE) prose --repo .
release: verify bench vae ## Build a complete local ZIP and installable tarball.
	$(BUN) scripts/release.ts
start stop restart status log: ## This library has no background service.
	@echo "$@: no service"
