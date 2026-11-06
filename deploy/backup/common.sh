#!/usr/bin/env bash
# Shared by backup.sh and restore.sh: connection settings from the same variables the backend uses.

set -euo pipefail

# where the backups folder is mounted
export BACKUP_ROOT=/backups

log() {
	echo "$(date '+%Y-%m-%d %H:%M:%S %Z') $*"
}

fail() {
	log "ERROR: $*" >&2
	exit 1
}

# DATABASE_URL is the backend's JDBC URL: jdbc:postgresql://host[:port]/database[?options]
parse_database_url() {
	local url="${DATABASE_URL:-}"
	[[ -n "$url" ]] || fail "DATABASE_URL is not set"
	[[ "$url" =~ ^jdbc:postgresql://([^/:?]+)(:([0-9]+))?/([^?]+) ]] ||
		fail "DATABASE_URL must look like jdbc:postgresql://host:5432/database"
	export PGHOST="${BASH_REMATCH[1]}"
	export PGPORT="${BASH_REMATCH[3]:-5432}"
	export PGDATABASE="${BASH_REMATCH[4]}"
	export PGUSER="${DATABASE_USERNAME:?DATABASE_USERNAME is not set}"
	export PGPASSWORD="${DATABASE_PASSWORD:?DATABASE_PASSWORD is not set}"
	export PGCONNECT_TIMEOUT=10
}

wait_for_database() {
	local tries=0
	until pg_isready --quiet; do
		tries=$((tries + 1))
		[[ $tries -lt 30 ]] || fail "PostgreSQL at $PGHOST:$PGPORT doesn't answer"
		sleep 2
	done
}

parse_database_url
