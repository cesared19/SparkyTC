#!/usr/bin/env bash
# Restores a backup made by backup.sh.
#
#   restore.sh list                         the backups there are, newest first
#   restore.sh <backup> --into <database>   into a new database, to check a backup without touching SparkyTC's
#   restore.sh <backup> --replace [--yes]   over SparkyTC's database (stop the backend first)
#
# <backup> is a path inside /backups, e.g. daily/sparkytc-20261106-030000.dump.

# shellcheck source=SCRIPTDIR/common.sh
source "$(dirname "$0")/common.sh"

usage() {
	fail "usage: restore.sh list | <backup> --into <database> | <backup> --replace [--yes]"
}

restore_into() {
	local file="$1" database="$2"
	log "Restoring $file into $database"
	# --exit-on-error: a partial restore must not look like a good one
	pg_restore --dbname="$database" --no-owner --no-privileges --exit-on-error "$file" ||
		fail "the restore stopped with an error; $database may be incomplete"
	local version
	version="$(psql --dbname="$database" --tuples-only --no-align \
		--command="SELECT version FROM schema_version ORDER BY creation_timestamp DESC LIMIT 1" 2>/dev/null || true)"
	log "Restore done: $database is on schema version ${version:-unknown}"
}

if [[ "${1:-}" == list ]]; then
	cd "$BACKUP_ROOT" || fail "there's no $BACKUP_ROOT"
	find . -name '*.dump' -type f -printf '%T@ %TY-%Tm-%Td %TH:%TM  %8k KB  %P\n' | sort -rn | cut -d' ' -f2-
	exit 0
fi

[[ $# -ge 2 ]] || usage
file="$1"
[[ "$file" == /* ]] || file="$BACKUP_ROOT/$file"
[[ -f "$file" ]] || fail "there's no backup $file (see restore.sh list)"
pg_restore --list "$file" >/dev/null || fail "$file isn't a backup pg_restore can read"
wait_for_database

case "$2" in
--into)
	target="${3:-}"
	[[ "$target" =~ ^[a-z_][a-z0-9_]*$ ]] || fail "give the new database a name of lowercase letters, digits and underscores"
	[[ "$target" != "$PGDATABASE" ]] || fail "--into is for a new database; use --replace to restore over $PGDATABASE"
	exists="$(psql --dbname=postgres --tuples-only --no-align --command="SELECT 1 FROM pg_database WHERE datname = '$target'")"
	[[ -z "$exists" ]] || fail "the database $target already exists; choose another name or drop it first"
	createdb --maintenance-db=postgres "$target" || fail "can't create the database $target"
	restore_into "$file" "$target"
	;;
--replace)
	others="$(psql --tuples-only --no-align --command="SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()")"
	[[ "$others" == 0 ]] || fail "$others other connections are using $PGDATABASE; stop SparkyTC first (docker compose stop backend-service)"
	if [[ "${3:-}" != --yes ]]; then
		echo "This replaces everything in $PGDATABASE on $PGHOST with $file."
		read -r -p "Type the database name to go on: " answer
		[[ "$answer" == "$PGDATABASE" ]] || fail "cancelled, nothing was changed"
	fi
	# everything SparkyTC has is in the public schema, including tables a newer version added after the backup
	log "Emptying $PGDATABASE"
	PGOPTIONS="-c client_min_messages=warning" psql --quiet --set=ON_ERROR_STOP=1 --command="DROP SCHEMA public CASCADE; CREATE SCHEMA public;" ||
		fail "can't empty $PGDATABASE, nothing was restored"
	restore_into "$file" "$PGDATABASE"
	;;
*)
	usage
	;;
esac
