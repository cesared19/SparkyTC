#!/usr/bin/env bash
# What uses the disk of the server that runs SparkyTC: the disk, Docker, the containers' logs, the backups and
# the database. It only reads. Run it from the server:
#
#   deploy/maintenance/disk-report.sh
#
# The sizes of the containers' logs need root (sudo deploy/maintenance/disk-report.sh).

set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")/../.."

echo "== Disk =="
df -h . "${BACKUP_DIR:-./backups}" 2>/dev/null | awk '!seen[$0]++'
echo

echo "== Docker (images, containers, volumes, build cache) =="
docker system df
echo

echo "== Container logs =="
found=no
for container in $(docker ps -aq); do
	name="$(docker inspect --format '{{.Name}}' "$container")"
	path="$(docker inspect --format '{{.HostConfig.LogConfig.Type}} {{.LogPath}}' "$container")"
	driver="${path%% *}"
	file="${path#* }"
	size="n/a (needs root)"
	if [[ -n "$file" ]] && [[ -r "$file" ]]; then
		size="$(du -h "$file" | cut -f1)"
	elif [[ -z "$file" ]]; then
		size="n/a ($driver)"
	fi
	printf '%-45s %s\n' "${name#/}" "$size"
	found=yes
done
[[ "$found" == yes ]] || echo "No containers"
echo

echo "== Backups and database =="
docker compose run --rm --no-deps database-backup report
