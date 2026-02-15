.PHONY: start stop deploy restart status help

# Variables
PID_FILE := wrangler.pid
LOG_FILE := wrangler.log

help:
	@echo "Available commands:"
	@echo "  make start    - Run the dev server in the background"
	@echo "  make stop     - Stop the background dev server"
	@echo "  make restart  - Restart the dev server"
	@echo "  make status   - Check if the dev server is running"
	@echo "  make force-stop - Forcefully stop all wrangler processes"
	@echo "  make deploy     - Deploy the application to Cloudflare"
	@echo "  make logs       - View the logs"
	@echo "  make test-bots  - Run bot detection tests using curl"

start:
	@if [ -f $(PID_FILE) ]; then \
		echo "Wrangler is already running (PID: $$(cat $(PID_FILE)))"; \
	else \
		echo "Starting Wrangler dev server in background..."; \
		nohup npm run dev > $(LOG_FILE) 2>&1 & echo $$! > $(PID_FILE); \
		sleep 2; \
		echo "Server started. PID: $$(cat $(PID_FILE)). Logs in $(LOG_FILE)"; \
	fi

stop:
	@if [ -f $(PID_FILE) ]; then \
		echo "Stopping Wrangler (PID: $$(cat $(PID_FILE)))..."; \
		kill $$(cat $(PID_FILE)) 2>/dev/null || true; \
		rm -f $(PID_FILE); \
	fi
	@echo "Cleaning up wrangler processes..."
	@pkill -f "wrangler" || true
	@echo "Stopped."

force-stop:
	@echo "Force stopping all wrangler processes..."
	@# Kill process holding the port first
	@fuser -k 8787/tcp >/dev/null 2>&1 || true
	@# Kill wrangler if it exists
	@pkill -f "wrangler" || true
	@# Kill node/wrangler process, being careful not to kill make
	@pgrep -f "node.*wrangler" | grep -v $$$$ | xargs -r kill -9 || true
	@rm -f $(PID_FILE)
	@echo "All wrangler processes stopped and port 8787 freed."

restart: stop start

status:
	@if [ -f $(PID_FILE) ]; then \
		echo "Wrangler is running with PID: $$(cat $(PID_FILE))"; \
		ps -p $$(cat $(PID_FILE)) > /dev/null || echo "Warning: PID file exists but process is not found."; \
	else \
		echo "Wrangler is not running (no PID file)."; \
		pgrep -f "wrangler dev" > /dev/null && echo "Note: A wrangler process was found but was not started by this Makefile." || true; \
	fi

deploy:
	@echo "Deploying to Cloudflare..."
	npm run deploy

logs:
	tail -f $(LOG_FILE)

test-bots:
	@./scripts/test_bots.sh
