#!/usr/bin/env bash
# Backs up SparkyTC's database with pg_dump into /backups, and keeps what they use in check.
#
#   backup.sh schedule        every day at BACKUP_TIME, keeping BACKUP_KEEP_DAILY daily and BACKUP_KEEP_WEEKLY weekly ones
#   backup.sh now [kind]      one backup now, into /backups/<kind> (manual by default; pre-migration before upgrading)
#   backup.sh prune           applies the retention now, to the copies that already exist
#   backup.sh report          what the backups and the database use
#   backup.sh restore ...     restore.sh, to list and restore backups
#
# Space: every kind keeps its newest BACKUP_KEEP_<KIND> copies; all together they stay under BACKUP_MAX_GB (the
# oldest go first, but the newest copy of each kind is always kept); and a backup only starts when there's room for
# it, BACKUP_MIN_FREE_GB beyond the size of the database.

# shellcheck source=SCRIPTDIR/common.sh
source "$(dirname "${BASH_SOURCE[0]}")/common.sh"

BACKUP_TIME="${BACKUP_TIME:-03:00}"
BACKUP_KEEP_DAILY="${BACKUP_KEEP_DAILY:-7}"
BACKUP_KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-4}"
BACKUP_KEEP_PRE_MIGRATION="${BACKUP_KEEP_PRE_MIGRATION:-5}"
BACKUP_KEEP_MANUAL="${BACKUP_KEEP_MANUAL:-5}"
# the day of the week (1 = Monday ... 7 = Sunday) whose daily backup is also kept as a weekly one
BACKUP_WEEKLY_DAY="${BACKUP_WEEKLY_DAY:-7}"
# all the backups together, in GB (0 = no limit), and the free space to leave on the disk, in GB
BACKUP_MAX_GB="${BACKUP_MAX_GB:-10}"
BACKUP_MIN_FREE_GB="${BACKUP_MIN_FREE_GB:-5}"
# written after each scheduled backup; the container's health check reads it
LAST_SUCCESS="$BACKUP_ROOT/.last-success"

# --- sizes ---------------------------------------------------------------------------------------------------

to_bytes() {
	awk -v gb="$1" 'BEGIN { printf "%d", gb * 1073741824 }'
}

human() {
	numfmt --to=iec --suffix=B "$1"
}

# the free space on the disk of the backups folder
free_bytes() {
	df -B1 --output=avail "$BACKUP_ROOT" | tail -n 1 | tr -d ' '
}

# what the backups use; du counts a file with two names (a weekly copy) once
used_bytes() {
	du -sb "$BACKUP_ROOT" | cut -f1
}

database_bytes() {
	psql --tuples-only --no-align --command="SELECT pg_database_size(current_database())"
}

# --- which copies go -----------------------------------------------------------------------------------------

all_backups_oldest_first() {
	find "$BACKUP_ROOT" -mindepth 2 -maxdepth 2 -name '*.dump' -type f -printf '%T@ %p\n' | sort -n | cut -d' ' -f2-
}

# the newest copy of each kind, which is never deleted to make room
newest_of_each_kind() {
	local dir
	for dir in "$BACKUP_ROOT"/*/; do
		[[ -d "$dir" ]] || continue
		find "$dir" -maxdepth 1 -name '*.dump' -type f -printf '%T@ %p\n' | sort -rn | awk 'NR == 1' | cut -d' ' -f2-
	done
}

# the oldest copy that may be deleted, or nothing when only the newest of each kind are left
oldest_unprotected() {
	local protected file
	protected="$(newest_of_each_kind)"
	while read -r file; do
		[[ -n "$file" ]] || continue
		if ! grep -qxF -- "$file" <<<"$protected"; then
			echo "$file"
			return 0
		fi
	done < <(all_backups_oldest_first)
	return 1
}

# Keeps the newest $2 backups in /backups/$1, at least one.
prune_count() {
	local dir="$BACKUP_ROOT/$1" keep="$2"
	[[ -d "$dir" ]] || return 0
	[[ "$keep" =~ ^[0-9]+$ && "$keep" -ge 1 ]] || keep=1
	find "$dir" -maxdepth 1 -name '*.dump' -type f -printf '%T@ %p\n' | sort -rn | tail -n +"$((keep + 1))" |
		cut -d' ' -f2- | while read -r old; do
			log "Deleting old backup $old"
			rm -f "$old"
		done
}

# What deleting every copy that may be deleted would free; a file with two names (a weekly copy) counts once, and
# not at all while one of its names is the newest of a kind.
reclaimable_bytes() {
	local protected_inodes file
	protected_inodes="$(
		newest_of_each_kind | while read -r file; do
			if [[ -n "$file" ]]; then stat -c %i "$file"; fi
		done
	)"
	find "$BACKUP_ROOT" -mindepth 2 -maxdepth 2 -name '*.dump' -type f -printf '%i %s\n' |
		awk -v protected="$protected_inodes" '
			BEGIN { n = split(protected, p, "\n"); for (i = 1; i <= n; i++) keep[p[i]] = 1 }
			!($1 in keep) && !($1 in seen) { seen[$1] = 1; total += $2 }
			END { print total + 0 }'
}

# Deletes the oldest copies until $1 bytes are free on the disk. Fails, without deleting anything, if that can't
# be reached without touching the newest copy of each kind.
make_room() {
	local needed="$1" candidate
	[[ "$(free_bytes)" -lt "$needed" ]] || return 0
	if [[ $(($(free_bytes) + $(reclaimable_bytes))) -lt "$needed" ]]; then
		return 1
	fi
	while [[ "$(free_bytes)" -lt "$needed" ]]; do
		candidate="$(oldest_unprotected)" || break
		log "Low disk space ($(human "$(free_bytes)") free, $(human "$needed") needed): deleting $candidate"
		rm -f "$candidate"
	done
	[[ "$(free_bytes)" -ge "$needed" ]]
}

# Deletes the oldest copies while the backups together use more than BACKUP_MAX_GB.
enforce_budget() {
	local max candidate
	max="$(to_bytes "$BACKUP_MAX_GB")"
	[[ "$max" -gt 0 ]] || return 0
	while [[ "$(used_bytes)" -gt "$max" ]]; do
		candidate="$(oldest_unprotected)" || {
			log "WARNING: the newest backups use $(human "$(used_bytes)"), over the limit of $(human "$max") (BACKUP_MAX_GB). The newest copy of each kind is always kept: raise the limit or free disk space."
			return 0
		}
		log "Backups use $(human "$(used_bytes)"), over the limit of $(human "$max"): deleting $candidate"
		rm -f "$candidate"
	done
}

# The retention of every kind, and then the limit of all of them.
prune_all() {
	# what a dump that was cut off (a stopped container, a full disk) left behind
	find "$BACKUP_ROOT" -mindepth 2 -maxdepth 2 -name '*.partial' -type f -mmin +60 -delete
	prune_count daily "$BACKUP_KEEP_DAILY"
	prune_count weekly "$BACKUP_KEEP_WEEKLY"
	prune_count pre-migration "$BACKUP_KEEP_PRE_MIGRATION"
	prune_count manual "$BACKUP_KEEP_MANUAL"
	enforce_budget
}

# --- backing up ----------------------------------------------------------------------------------------------

# Dumps the database to /backups/<kind>/sparkytc-<date>.dump and prints the file's path.
dump() {
	local kind="$1"
	local dir="$BACKUP_ROOT/$kind"
	local file
	file="$dir/${PGDATABASE}-$(date '+%Y%m%d-%H%M%S').dump"
	mkdir -p "$dir" || fail "can't create $dir"
	wait_for_database

	# a full disk breaks more than the backup: make room first, or say why it can't be done
	local database needed
	database="$(database_bytes)"
	needed=$((database + $(to_bytes "$BACKUP_MIN_FREE_GB")))
	make_room "$needed" ||
		fail "not enough free disk space for a backup: $(human "$(free_bytes)") free in $BACKUP_ROOT, and it needs about $(human "$database") (the database) plus $(human "$(to_bytes "$BACKUP_MIN_FREE_GB")") to spare, with only the newest copy of each kind left. Free disk space (see 'Disk space' in the README) or lower BACKUP_MIN_FREE_GB."

	log "Backing up $PGDATABASE on $PGHOST:$PGPORT to $file" >&2
	# custom format: compressed, and pg_restore can restore all of it or part of it
	if ! pg_dump --format=custom --no-owner --no-privileges --file="$file.partial"; then
		rm -f "$file.partial"
		fail "pg_dump failed, no backup was written (is the disk full?)"
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

daily_backup() {
	local file
	# runs as part of `||`, where set -e doesn't apply, so each step checks itself
	file="$(dump daily)" || return 1
	if [[ "$(date +%u)" == "$BACKUP_WEEKLY_DAY" ]]; then
		# a second name for the same file: the weekly copy doesn't use the space twice
		mkdir -p "$BACKUP_ROOT/weekly" &&
			{ ln "$file" "$BACKUP_ROOT/weekly/" 2>/dev/null || cp "$file" "$BACKUP_ROOT/weekly/"; } || return 1
		log "Kept as this week's backup too"
	fi
	prune_all
	log "Backups use $(human "$(used_bytes)"); $(human "$(free_bytes)") free on the disk"
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

# --- report --------------------------------------------------------------------------------------------------

report() {
	echo "== Backups in $BACKUP_ROOT =="
	local dir count
	for dir in "$BACKUP_ROOT"/*/; do
		[[ -d "$dir" ]] || continue
		count="$(find "$dir" -maxdepth 1 -name '*.dump' -type f | wc -l)"
		printf '%-16s %3d copies  %8s\n' "$(basename "$dir")" "$count" "$(human "$(du -sb "$dir" | cut -f1)")"
	done
	local limit=none
	if [[ "$(to_bytes "$BACKUP_MAX_GB")" -gt 0 ]]; then
		limit="$(human "$(to_bytes "$BACKUP_MAX_GB")")"
	fi
	printf '%-16s %8s of the limit of %s (BACKUP_MAX_GB), %s free on the disk\n' "all together" \
		"$(human "$(used_bytes)")" "$limit" "$(human "$(free_bytes)")"
	echo
	echo "== The database $PGDATABASE =="
	psql --no-psqlrc --quiet --command="SELECT pg_size_pretty(pg_database_size(current_database())) AS database_size"
	echo "Largest tables:"
	psql --no-psqlrc --quiet --command="
		SELECT relname AS table, pg_size_pretty(pg_total_relation_size(relid)) AS size
		FROM pg_catalog.pg_statio_user_tables ORDER BY pg_total_relation_size(relid) DESC LIMIT 8"
	echo "Attachments (images, videos and evidence), by type:"
	psql --no-psqlrc --quiet --command="
		SELECT split_part(content_type, '/', 1) AS type, count(*) AS files, pg_size_pretty(sum(file_size)) AS size
		FROM test_case_attachments GROUP BY 1 ORDER BY sum(file_size) DESC"
}

# --- commands ------------------------------------------------------------------------------------------------

main() {
	case "${1:-schedule}" in
	schedule)
		# fails at start if the settings are wrong, instead of on the first night
		seconds_until_next_backup >/dev/null
		wait_for_database
		log "Daily backups at $BACKUP_TIME, keeping $BACKUP_KEEP_DAILY daily and $BACKUP_KEEP_WEEKLY weekly ones in $BACKUP_ROOT, at most $BACKUP_MAX_GB GB in all"
		# applies the retention to what's already there, so a smaller limit works from the start
		prune_all || log "The retention couldn't be applied, see the messages above"
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
		prune_all
		exit 0
		;;
	prune)
		prune_all
		log "Backups use $(human "$(used_bytes)"); $(human "$(free_bytes)") free on the disk"
		;;
	report)
		report
		;;
	restore)
		shift
		exec bash "$(dirname "${BASH_SOURCE[0]}")/restore.sh" "$@"
		;;
	healthy)
		# the last scheduled backup is less than 26 hours old, and the disk isn't running out
		[[ -f "$LAST_SUCCESS" ]] && [[ $(($(date +%s) - $(cat "$LAST_SUCCESS"))) -lt 93600 ]] &&
			[[ "$(free_bytes)" -ge "$(to_bytes "$BACKUP_MIN_FREE_GB")" ]]
		;;
	*)
		fail "usage: backup.sh schedule | now [kind] | prune | report | restore ... | healthy"
		;;
	esac
}

# sourced by the tests, which call the functions
if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then
	main "$@"
fi
