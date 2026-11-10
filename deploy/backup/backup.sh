#!/usr/bin/env bash
# Backs up SparkyTC's database with pg_dump into /backups.
#
#   backup.sh schedule        every day at BACKUP_TIME, keeping BACKUP_KEEP_DAILY daily and BACKUP_KEEP_WEEKLY weekly ones
#   backup.sh now [kind]      one backup now, into /backups/<kind> (manual by default; pre-migration before upgrading)
#   backup.sh restore ...     restore.sh, to list and restore backups

# shellcheck source=SCRIPTDIR/common.sh
source "$(dirname "$0")/common.sh"

BACKUP_TIME="${BACKUP_TIME:-03:00}"
BACKUP_KEEP_DAILY="${BACKUP_KEEP_DAILY:-14}"
BACKUP_KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-8}"
BACKUP_KEEP_PRE_MIGRATION="${BACKUP_KEEP_PRE_MIGRATION:-10}"
# the day of the week (1 = Monday ... 7 = Sunday) whose daily backup is also kept as a weekly one
BACKUP_WEEKLY_DAY="${BACKUP_WEEKLY_DAY:-7}"
# written after each scheduled backup; the container's health check reads it
LAST_SUCCESS="$BACKUP_ROOT/.last-success"

# Dumps the database to /backups/<kind>/sparkytc-<date>.dump and prints the file's path.
dump() {
	local kind="$1"
	local dir="$BACKUP_ROOT/$kind"
	local file
	file="$dir/${PGDATABASE}-$(date '+%Y%m%d-%H%M%S').dump"
	mkdir -p "$dir" || fail "can't create $dir"
	wait_for_database
	log "Backing up $PGDATABASE on $PGHOST:$PGPORT to $file" >&2
	# custom format: compressed, and pg_restore can restore all of it or part of it
	if ! pg_dump --format=custom --no-owner --no-privileges --file="$file.partial"; then
		rm -f "$file.partial"
		fail "pg_dump failed, no backup was written"
	fi
	# a dump pg_restore can't read isn't a backup
	pg_restore --list "$file.partial" >/dev/null || {
		rm -f "$file.partial"
		fail "the backup can't be read back, it was deleted"
	}
	mv "$file.partial" "$file" || fail "can't write $file"
	log "Backup done: $file ($(du -h "$file" | cut -f1))" >&2
	echo "$file"
}

# Keeps the newest $2 backups in /backups/$1.
prune() {
	local dir="$BACKUP_ROOT/$1" keep="$2"
	[[ -d "$dir" ]] || return 0
	find "$dir" -maxdepth 1 -name '*.dump' -type f -printf '%T@ %p\n' | sort -rn | tail -n +"$((keep + 1))" |
		cut -d' ' -f2- | while read -r old; do
			log "Deleting old backup $old"
			rm -f "$old"
		done
}

daily_backup() {
	local file
	# runs as part of `||`, where set -e doesn't apply, so each step checks itself
	file="$(dump daily)" || return 1
	if [[ "$(date +%u)" == "$BACKUP_WEEKLY_DAY" ]]; then
		mkdir -p "$BACKUP_ROOT/weekly" && cp "$file" "$BACKUP_ROOT/weekly/" || return 1
		log "Kept as this week's backup too"
	fi
	prune daily "$BACKUP_KEEP_DAILY"
	prune weekly "$BACKUP_KEEP_WEEKLY"
	date +%s >"$LAST_SUCCESS"
}

seconds_until_next_backup() {
	local now next
	now="$(date +%s)"
	next="$(date -d "today $BACKUP_TIME" +%s)" || fail "BACKUP_TIME must be HH:MM, e.g. 03:00"
	if [[ "$next" -le "$now" ]]; then
		next="$(date -d "tomorrow $BACKUP_TIME" +%s)"
	fi
	echo $((next - now))
}

case "${1:-schedule}" in
schedule)
	# fails at start if the settings are wrong, instead of on the first night
	seconds_until_next_backup >/dev/null
	wait_for_database
	log "Daily backups at $BACKUP_TIME, keeping $BACKUP_KEEP_DAILY daily and $BACKUP_KEEP_WEEKLY weekly ones in $BACKUP_ROOT"
	# the health check counts from the start until the first backup
	[[ -f "$LAST_SUCCESS" ]] || date +%s >"$LAST_SUCCESS"
	while true; do
		wait_seconds="$(seconds_until_next_backup)"
		log "Next backup in $((wait_seconds / 3600))h $((wait_seconds % 3600 / 60))m"
		sleep "$wait_seconds"
		# a failed night is logged and tried again the next day; the health check shows it meanwhile
		(daily_backup) || log "The daily backup failed, see the messages above"
	done
	;;
now)
	kind="${2:-manual}"
	[[ "$kind" =~ ^[a-z0-9-]+$ ]] || fail "the kind of backup can only have lowercase letters, digits and dashes"
	dump "$kind" >/dev/null
	[[ "$kind" == pre-migration ]] && prune pre-migration "$BACKUP_KEEP_PRE_MIGRATION"
	exit 0
	;;
restore)
	shift
	exec bash "$(dirname "$0")/restore.sh" "$@"
	;;
healthy)
	# the last scheduled backup is less than 26 hours old
	[[ -f "$LAST_SUCCESS" ]] && [[ $(($(date +%s) - $(cat "$LAST_SUCCESS"))) -lt 93600 ]]
	;;
*)
	fail "usage: backup.sh schedule | now [kind] | restore ... | healthy"
	;;
esac
