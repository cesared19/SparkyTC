#!/usr/bin/env bash
# Tests of the backup retention and the free-space check, with fake backups in a temporary folder (no database).
# Run it from anywhere: bash deploy/backup/test.sh

set -euo pipefail

export DATABASE_URL=jdbc:postgresql://localhost:5432/test DATABASE_USERNAME=test DATABASE_PASSWORD=test
BACKUP_ROOT="$(mktemp -d)"
export BACKUP_ROOT
trap 'rm -rf "$BACKUP_ROOT"' EXIT

# shellcheck source=SCRIPTDIR/backup.sh
source "$(dirname "${BASH_SOURCE[0]}")/backup.sh"
# the tests read the log themselves
log() { :; }

failures=0
check() {
	local name="$1" expected="$2" actual="$3"
	if [[ "$expected" == "$actual" ]]; then
		echo "ok   $name"
	else
		echo "FAIL $name"
		echo "     expected: $expected"
		echo "     actual:   $actual"
		failures=$((failures + 1))
	fi
}

MB=1048576
reset() {
	rm -rf "${BACKUP_ROOT:?}"/*
	BACKUP_KEEP_DAILY=7 BACKUP_KEEP_WEEKLY=4 BACKUP_KEEP_PRE_MIGRATION=5 BACKUP_KEEP_MANUAL=5
	BACKUP_MAX_GB=0
}
# a fake backup of kind $1, number $2 (the higher, the newer), $3 MB big
backup() {
	local file
	file="$BACKUP_ROOT/$1/test-$(printf '%03d' "$2").dump"
	mkdir -p "$BACKUP_ROOT/$1"
	truncate -s "$(($3 * MB))" "$file"
	touch -d "@$((1700000000 + $2 * 86400))" "$file"
}
names() {
	find "$BACKUP_ROOT/$1" -name '*.dump' -printf '%f\n' | sort | sed 's/test-0*//; s/.dump//' | paste -sd' ' -
}
all_names() {
	find "$BACKUP_ROOT" -name '*.dump' -printf '%h/%f\n' | sed "s#$BACKUP_ROOT/##; s/test-0*//; s/.dump//" | sort | paste -sd' ' -
}

# --- retention by count ---
reset
for n in 1 2 3 4 5; do backup daily "$n" 1; done
BACKUP_KEEP_DAILY=2
prune_all
check "keeps the newest copies of a kind" "4 5" "$(names daily)"

reset
for n in 1 2 3; do backup daily "$n" 1; done
BACKUP_KEEP_DAILY=0
prune_all
check "always keeps at least one copy" "3" "$(names daily)"

reset
for n in 1 2 3 4 5 6 7; do backup manual "$n" 1; done
prune_all
check "manual backups are limited too (default 5)" "3 4 5 6 7" "$(names manual)"

# --- leftovers ---
reset
backup daily 1 1
mkdir -p "$BACKUP_ROOT/daily"
truncate -s 1M "$BACKUP_ROOT/daily/cut-off.dump.partial"
touch -d '2 hours ago' "$BACKUP_ROOT/daily/cut-off.dump.partial"
truncate -s 1M "$BACKUP_ROOT/daily/running.dump.partial"
prune_all
check "removes a dump that was cut off, not the one running now" "running.dump.partial" "$(find "$BACKUP_ROOT/daily" -name '*.partial' -printf '%f\n')"

# --- the size limit ---
reset
for n in 1 2 3; do backup daily "$n" 4; done
for n in 4 5; do backup pre-migration "$n" 4; done
BACKUP_MAX_GB="$(awk 'BEGIN { print 17 / 1024 }')" # 17 MB for 20 MB of copies: four of the five
prune_all
check "the oldest copies go first when over the limit" "daily/2 daily/3 pre-migration/4 pre-migration/5" "$(all_names)"

reset
backup daily 1 4
backup daily 2 4
backup weekly 3 4
backup pre-migration 4 4
BACKUP_MAX_GB="$(awk 'BEGIN { print 1 / 1024 }')" # 1 MB: less than any single copy
prune_all
check "the newest copy of each kind is kept, even over the limit" "daily/2 pre-migration/4 weekly/3" "$(all_names)"

reset
backup daily 1 4
ln "$BACKUP_ROOT/daily/test-001.dump" "$BACKUP_ROOT/weekly/" 2>/dev/null || { mkdir -p "$BACKUP_ROOT/weekly"; ln "$BACKUP_ROOT/daily/test-001.dump" "$BACKUP_ROOT/weekly/"; }
check "a weekly copy that is a link doesn't use the space twice" "true" "$([[ "$(used_bytes)" -lt $((6 * MB)) ]] && echo true || echo false)"

# --- the free-space check, on a disk of 20 MB ---
DISK=$((20 * MB))
free_bytes() { echo $((DISK - $(used_bytes))); }

reset
for n in 1 2 3; do backup daily "$n" 5; done # 15 MB used, 5 MB free
make_room $((12 * MB)) && made=yes || made=no
check "makes room by deleting the oldest copies" "yes daily/3" "$made $(all_names)"

reset
backup daily 1 7
backup pre-migration 2 7 # 14 MB used, 6 MB free, and both are the newest of their kind
make_room $((12 * MB)) && made=yes || made=no
check "doesn't touch the newest copy of each kind" "no daily/1 pre-migration/2" "$made $(all_names)"

reset
backup daily 1 7
backup daily 2 7
backup daily 3 1 # the newest, 15 MB used, 5 MB free; deleting the two older ones would only reach 19 MB
make_room $((25 * MB)) && made=yes || made=no
check "deletes nothing when the room can't be made anyway" "no daily/1 daily/2 daily/3" "$made $(all_names)"

reset
backup daily 1 7
ln "$BACKUP_ROOT/daily/test-001.dump" "$BACKUP_ROOT/weekly/" 2>/dev/null || { mkdir -p "$BACKUP_ROOT/weekly"; ln "$BACKUP_ROOT/daily/test-001.dump" "$BACKUP_ROOT/weekly/"; }
backup daily 2 7 # the weekly link of daily/1 is the newest weekly: its data can't be freed
make_room $((10 * MB)) && made=yes || made=no
check "a copy whose other name is protected frees nothing" "no daily/1 daily/2 weekly/1" "$made $(all_names)"

reset
backup daily 1 2
make_room $((5 * MB)) && made=yes || made=no
check "does nothing when there is room" "yes daily/1" "$made $(all_names)"

if [[ "$failures" -gt 0 ]]; then
	echo "$failures failed"
	exit 1
fi
echo "all passed"
